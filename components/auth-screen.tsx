"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";

export type AuthRole = "seeker" | "employer";
export type AuthMode = "login" | "register";

export function AuthScreen({ mode, role }: { mode: AuthMode; role: AuthRole }) {
  const [submitted, setSubmitted] = useState(false);
  const [socialProvider, setSocialProvider] = useState<
    "Facebook" | "Google" | null
  >(null);
  const isRegister = mode === "register";
  const isEmployer = role === "employer";
  const otherMode = isRegister ? "login" : "register";
  const otherHref = `/${otherMode}?role=${role}`;
  const title = isRegister
    ? `Create your ${isEmployer ? "employer" : "job seeker"} account`
    : `Welcome back${isEmployer ? ", employer" : ""}`;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSocialProvider(null);
    setSubmitted(true);
  }

  return (
    <main id="main-content" className="auth-page">
      <header className="auth-header container">
        <Link href="/" className="brand" aria-label="Openrole home">
          <span className="brand-symbol">
            <Icon name="arrow" size={23} />
          </span>
          openrole<span className="brand-period">.</span>
        </Link>
        <nav className="auth-role-switch" aria-label="Account type">
          <Link
            href={`/${mode}?role=seeker`}
            className={role === "seeker" ? "auth-role-active" : ""}
            aria-current={role === "seeker" ? "page" : undefined}
          >
            Job seeker
          </Link>
          <Link
            href={`/${mode}?role=employer`}
            className={isEmployer ? "auth-role-active" : ""}
            aria-current={isEmployer ? "page" : undefined}
          >
            Employer
          </Link>
        </nav>
        <Link
          href="/"
          className="auth-close"
          aria-label="Close and return home"
        >
          <Icon name="close" size={23} />
        </Link>
      </header>
      <div className="auth-main container">
        <section className="auth-panel" aria-labelledby="auth-title">
          <span className="auth-eyebrow">
            {isEmployer ? "For hiring teams" : "For your next move"}
          </span>
          <h1 id="auth-title">{title}</h1>
          <p className="auth-intro">
            {isRegister
              ? isEmployer
                ? "Start with an account for your hiring team."
                : "A simpler way to keep your job search moving."
              : isEmployer
                ? "Sign in to continue with your hiring team."
                : "Sign in to continue your search."}
          </p>
          <div className="auth-social" aria-label="Social sign in options">
            <button
              type="button"
              className="auth-social-button auth-social-facebook"
              onClick={() => {
                setSubmitted(false);
                setSocialProvider("Facebook");
              }}
            >
              <span
                className="auth-provider-mark auth-provider-facebook"
                aria-hidden="true"
              >
                f
              </span>
              Facebook
            </button>
            <button
              type="button"
              className="auth-social-button auth-social-google"
              onClick={() => {
                setSubmitted(false);
                setSocialProvider("Google");
              }}
            >
              <span
                className="auth-provider-mark auth-provider-google"
                aria-hidden="true"
              >
                G
              </span>
              Google
            </button>
          </div>
          {socialProvider && (
            <p className="auth-status auth-social-status" role="status">
              {socialProvider} sign-in is not available in this Phase 1 preview.
              No account connection was started.
            </p>
          )}
          <div className="auth-divider">
            <span>or continue with email</span>
          </div>
          <form
            className="auth-form"
            onSubmit={handleSubmit}
            onChange={() => setSubmitted(false)}
          >
            {isRegister && (
              <label className="auth-field">
                Full name
                <input
                  name="name"
                  type="text"
                  autoComplete="name"
                  placeholder="Your full name"
                  required
                  maxLength={100}
                />
              </label>
            )}
            <label className="auth-field">
              Email address
              <input
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                maxLength={254}
              />
            </label>
            <label className="auth-field">
              Password
              <input
                name="password"
                type="password"
                autoComplete={isRegister ? "new-password" : "current-password"}
                placeholder={
                  isRegister ? "Create a password" : "Enter your password"
                }
                required
                minLength={8}
              />
            </label>
            <button className="primary-button auth-submit" type="submit">
              {isRegister ? "Create account" : "Sign in"}{" "}
              <Icon name="arrow" size={18} />
            </button>
            {submitted && (
              <p className="auth-status" role="status">
                Account access is not available in this Phase 1 preview. Your
                details were not sent or saved.
              </p>
            )}
          </form>
          <p className="auth-switch">
            {isRegister ? "Already have an account?" : "New to Openrole?"}{" "}
            <Link href={otherHref}>
              {isRegister ? "Sign in" : "Create an account"}
            </Link>
          </p>
        </section>
        <p className="auth-note">
          Account access is being prepared. This preview does not send or save
          your details.
        </p>
      </div>
    </main>
  );
}
