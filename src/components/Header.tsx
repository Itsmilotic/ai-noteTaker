import { shadow } from "@/styles/utils";
import Link from "next/link";
import { Button } from "./ui/button";
import DarkModeToggle from "./DarkModeToggle";
import LogOutButton from "./LogOutButton";
import { getUser } from "@/auth/server";
import { SidebarTrigger } from "./ui/sidebar";

async function Header() {
  const user = await getUser();

  return (
    <header
      className="bg-popover relative flex h-24 w-full items-center justify-between px-3 sm:px-8"
      style={{
        boxShadow: shadow,
      }}
    >
      <div className="flex items-center gap-4">
        <SidebarTrigger className="relative text-primary hover:text-primary/80 h-12 w-12 border " />

        <Link className="flex items-end gap-2" href="/">
          <h1 className="flex flex-col pb-1 text-2xl font-semibold leading-6 text-primary">
            Ai <span className="text-foreground">Notes</span>
          </h1>
        </Link>
      </div>

      <div className="flex gap-4">
        {user ? (
          <LogOutButton />
        ) : (
          <>
            <Button asChild className="shadow-lg shadow-primary/30">
              <Link href="/sign-up" className="hidden sm:block">
                Sign Up
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-primary/60 text-primary hover:bg-primary/10"
            >
              <Link href="/login">Login</Link>
            </Button>
          </>
        )}
        <DarkModeToggle />
      </div>
    </header>
  );
}

export default Header;
