"use server";

import { getUser } from "@/auth/server";
import { prisma } from "@/db/prisma";
import { handleError } from "@/lib/utils";
import { Content, GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/files";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";

export const createNoteAction = async (noteId: string) => {
  try {
    const user = await getUser();
    if (!user) throw new Error("You must be logged in to create a note");

    await prisma.note.create({
      data: {
        id: noteId,
        authorId: user.id,
        text: "",
      },
    });

    return { errorMessage: null };
  } catch (error) {
    return handleError(error);
  }
};

export const updateNoteAction = async (noteId: string, text: string) => {
  try {
    const user = await getUser();
    if (!user) throw new Error("You must be logged in to update a note");

    await prisma.note.update({
      where: { id: noteId },
      data: { text },
    });

    return { errorMessage: null };
  } catch (error) {
    return handleError(error);
  }
};

export const deleteNoteAction = async (noteId: string) => {
  try {
    const user = await getUser();
    if (!user) throw new Error("You must be logged in to delete a note");

    await prisma.note.delete({
      where: { id: noteId, authorId: user.id },
    });

    return { errorMessage: null };
  } catch (error) {
    return handleError(error);
  }
};

export const askAIAboutNotesAction = async (
  newQuestions: string[],
  responses: string[],
) => {
  const apiKey = process.env.OPENAI_API_KEY ?? undefined;
  if (!apiKey) {
    throw new Error("Gemini/OpenAI API key is not configured");
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  const user = await getUser();
  if (!user) throw new Error("You must be logged in to ask AI questions");

  const notes = await prisma.note.findMany({
    where: { authorId: user.id },
    orderBy: { createdAt: "desc" },
    select: { text: true, createdAt: true, updatedAt: true },
  });

  if (notes.length === 0) {
    return "You don't have any notes yet.";
  }

  const formattedNotes = notes
    .map((note) =>
      `
      Text: ${note.text}
      Created at: ${note.createdAt}
      Last updated: ${note.updatedAt}
      `.trim(),
    )
    .join("\n");

  const instructions = `
        You are a helpful assistant that answers questions about a user's notes. 
        Assume all questions are related to the user's notes. 
        Make sure that your answers are not too verbose and you speak succinctly. 
        Your responses MUST be formatted in clean, valid HTML with proper structure. 
        Use tags like <p>, <strong>, <em>, <ul>, <ol>, <li>, <h1> to <h6>, and <br> when appropriate. 
        Do NOT wrap the entire response in a single <p> tag unless it's a single paragraph. 
        Avoid inline styles, JavaScript, or custom attributes.
        
        Rendered like this in JSX:
        <p dangerouslySetInnerHTML={{ __html: YOUR_RESPONSE }} />
  
        Here are the user's notes:
        ${formattedNotes}
        `.trim();

  const history: Content[] = [
    {
      role: "user",
      parts: [{ text: instructions }],
    },
  ];

  for (let i = 0; i < newQuestions.length; i++) {
    history.push({
      role: "user",
      parts: [{ text: newQuestions[i] }],
    });
    if (responses.length > i) {
      history.push({
        role: "model",
        parts: [{ text: responses[i] }],
      });
    }
  }

  const model = genAI.getGenerativeModel(
    {
      model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
    },
    { apiVersion: "v1" },
  );

  const completion = await model.generateContent({ contents: history });
  const responseText = completion.response.text();

  return responseText?.trim() || "A problem has occurred";
};

export const analyzePdfWithGeminiAction = async (file: File, prompt: string) => {
  const apiKey = process.env.OPENAI_API_KEY ?? undefined;
  if (!apiKey) {
    throw new Error("Gemini/OpenAI API key is not configured");
  }

  const user = await getUser();
  if (!user) throw new Error("You must be logged in to analyze a PDF");

  if (!file || typeof file.arrayBuffer !== "function") {
    throw new Error("A valid PDF file is required");
  }

  const mimeType = file.type || "application/pdf";
  if (!mimeType.includes("pdf")) {
    throw new Error("Only PDF files are supported");
  }

  const fileManager = new GoogleAIFileManager(apiKey, {
    apiVersion: process.env.GEMINI_FILES_API_VERSION ?? "v1beta",
  });
  const genAI = new GoogleGenerativeAI(apiKey);

  const fileBytes = new Uint8Array(await file.arrayBuffer());
  const fileBuffer = Buffer.from(fileBytes);
  const tempFilePath = join(
    tmpdir(),
    `ai-notes-upload-${randomUUID()}.pdf`,
  );

  let uploadedFile: Awaited<
    ReturnType<typeof fileManager.uploadFile>
  > | null = null;

  try {
    await fs.writeFile(tempFilePath, fileBuffer);

    uploadedFile = await fileManager.uploadFile(tempFilePath, {
      mimeType,
      displayName: file.name || "user-uploaded.pdf",
    });

    const model = genAI.getGenerativeModel(
      {
        model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
      },
      { apiVersion: "v1" },
    );

    const basePrompt =
      prompt && prompt.trim().length > 0
        ? prompt.trim()
        : "Provide a concise, structured summary of the uploaded PDF.";

    const htmlInstructions = `
You are a helpful assistant summarizing the provided PDF.
Return the response as clean, semantically structured HTML suitable for direct rendering.
Use elements like <article>, <section>, <h2>, <h3>, <p>, <ul>, and <li>.
Highlight key differences or takeaways with bullet lists.
Do not include Markdown, code fences, or inline styles.
`.trim();

    const combinedPrompt = `${htmlInstructions}\n\nUser prompt:\n${basePrompt}`;

    const completion = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: combinedPrompt,
            },
            {
              inlineData: {
                data: Buffer.from(fileBuffer).toString("base64"),
                mimeType,
              },
            },
          ],
        },
      ],
    });

    const responseText = completion.response.text();
    return responseText?.trim() || "A problem has occurred";
  } finally {
    if (uploadedFile?.file?.name) {
      await fileManager.deleteFile(uploadedFile.file.name).catch(() => {
        // Swallow file deletion errors to avoid masking the main response.
      });
    }
    await fs.unlink(tempFilePath).catch(() => {
      // Ignore delete errors for temp file.
    });
  }
};

export const generateQuestionsAboutNotesAction = async (
  requestedCount: number,
) => {
  const apiKey = process.env.OPENAI_API_KEY ?? undefined;
  if (!apiKey) {
    throw new Error("Gemini/OpenAI API key is not configured");
  }

  const user = await getUser();
  if (!user) throw new Error("You must be logged in to ask AI questions");

  const questionCount = Number.isFinite(requestedCount)
    ? Math.min(Math.max(Math.round(requestedCount), 1), 10)
    : 3;

  const notes = await prisma.note.findMany({
    where: { authorId: user.id },
    orderBy: { createdAt: "desc" },
    select: { text: true, createdAt: true, updatedAt: true },
  });

  if (notes.length === 0) {
    return [];
  }

  const formattedNotes = notes
    .map((note) =>
      `
      Text: ${note.text}
      Created at: ${note.createdAt}
      Last updated: ${note.updatedAt}
      `.trim(),
    )
    .join("\n");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel(
    {
      model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
    },
    { apiVersion: "v1" },
  );

  const prompt = `
You are reviewing a user's personal notes.
Generate ${questionCount} insightful, distinct questions the user might ask an AI assistant to learn more from their notes.
Return ONLY valid JSON in the following format without extra commentary:
{"questions": ["Question 1", "Question 2"]}
Questions should be answerable using the provided notes and avoid duplicates.

Notes:
${formattedNotes}
`.trim();

  const completion = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
  });

  const responseText = completion.response.text()?.trim() ?? "";

  const parseQuestions = (raw: string): string[] => {
    if (!raw) return [];

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const jsonCandidate = jsonMatch ? jsonMatch[0] : raw;

    try {
      const parsed = JSON.parse(jsonCandidate) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .map((item: unknown) => (typeof item === "string" ? item.trim() : ""))
          .filter(Boolean);
      }

      if (
        parsed &&
        typeof parsed === "object" &&
        Array.isArray((parsed as { questions?: unknown[] }).questions)
      ) {
        return (parsed as { questions: unknown[] }).questions
          .map((item: unknown) => (typeof item === "string" ? item.trim() : ""))
          .filter(Boolean);
      }
    } catch {
      // fallback handled below
    }

    return raw
      .split("\n")
      .map((line) => line.replace(/^[-*\d.\s)]+/, "").trim())
      .filter(Boolean);
  };

  const questions = parseQuestions(responseText)
    .filter(Boolean)
    .filter((question, index, self) => self.indexOf(question) === index)
    .slice(0, questionCount);

  return questions;
};
