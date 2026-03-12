import "./globals.css";

export const metadata = {
  title: "Market Tracker",
  description: "Real-time market data tracker",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
