import RegisterForm from '@/components/auth/RegisterForm';
export default function RegisterPage() {
  return <div className="min-h-screen bg-wa-dark flex items-center justify-center p-4"><div className="w-full max-w-md"><div className="text-center mb-8"><h1 className="text-2xl font-semibold text-wa-text">Create account</h1><p className="text-wa-muted mt-1 text-sm">Start messaging instantly</p></div><RegisterForm /></div></div>;
}
