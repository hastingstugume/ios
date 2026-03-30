export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark" data-theme="dark">
      {children}
    </div>
  );
}
