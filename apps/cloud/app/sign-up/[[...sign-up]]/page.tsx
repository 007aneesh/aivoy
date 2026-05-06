import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
      }}
    >
      <SignUp />
    </main>
  );
}
