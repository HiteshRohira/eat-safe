import LoginForm from "@/components/auth/LoginForm";

function Register() {
  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm route="/api/user/register/" method="register" />
      </div>
    </div>
  );
}

export default Register;
