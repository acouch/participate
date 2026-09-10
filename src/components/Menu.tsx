"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import phillyBudgetLogo from "@/src/assets/phillybudgetlogo.svg";
import AuthNav, { type AuthNavUser } from "@/src/components/auth/AuthNav";

interface MenuProps {
  /** The signed-in user, resolved on the server in the root layout. */
  user: AuthNavUser | null;
}

export default function Menu({ user }: MenuProps) {
  useEffect(() => {
    const btn = document.getElementById("mobile-menu-toggle");
    const panel = document.getElementById("mobile-menu-panel");
    if (!btn || !panel) return;

    const bars = btn.querySelector("[data-icon-bars]");
    const x = btn.querySelector("[data-icon-x]");

    const handleClick = () => {
      const isHidden = panel.classList.contains("hidden");
      if (isHidden) {
        panel.classList.remove("hidden");
        btn.setAttribute("aria-expanded", "true");
        if (bars && x) {
          bars.classList.add("opacity-0", "scale-90");
          x.classList.remove("opacity-0", "scale-90");
        }
      } else {
        panel.classList.add("hidden");
        btn.setAttribute("aria-expanded", "false");
        if (bars && x) {
          bars.classList.remove("opacity-0", "scale-90");
          x.classList.add("opacity-0", "scale-90");
        }
      }
    };

    btn.addEventListener("click", handleClick);
    return () => btn.removeEventListener("click", handleClick);
  }, []);

  return (
    <header className="pt-1 pb-4">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <nav className="relative z-50 flex justify-between">
          <div className="flex items-center md:gap-x-12">
            <Link aria-label="Home" href="/">
              <Image
                loading="eager"
                width={250}
                height={48}
                unoptimized
                alt="philly budget logo"
                src={phillyBudgetLogo}
              />
            </Link>
          </div>
          <AuthNav user={user} />
        </nav>
      </div>
    </header>
  );
}
