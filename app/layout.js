import "./globals.css";

export const metadata = {
  title: "Market Tracker",
  description: "Real-time market data tracker",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/twemoji.min.js"></script>
        <script dangerouslySetInnerHTML={{ __html: `
          document.addEventListener('DOMContentLoaded', function() {
            twemoji.parse(document.body, { folder: 'svg', ext: '.svg' });
          });
        `}} />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
