import DgenSignInProvider from './providers';

// Wrap only the pages that need sign-in, or the whole app as here.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <DgenSignInProvider>{children}</DgenSignInProvider>
      </body>
    </html>
  );
}
