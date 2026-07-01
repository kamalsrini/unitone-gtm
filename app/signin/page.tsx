import { signIn } from "@/auth";
export const dynamic = "force-dynamic";

export default function SignIn() {
  return (
    <div className="grid min-h-[65vh] place-items-center">
      <div className="card w-full max-w-sm p-8 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="https://unitone.ai/images/unitone-icon.png" alt="UnitOne" className="mx-auto h-12 w-auto" />
        <h1 className="mt-4 text-xl font-semibold tracking-tight">UnitOne <span className="text-muted">GTM Engine</span></h1>
        <p className="mt-1 text-sm text-muted">Sign in to continue</p>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
          className="mt-6"
        >
          <button type="submit" className="btn-primary w-full">Sign in with Google</button>
        </form>
      </div>
    </div>
  );
}
