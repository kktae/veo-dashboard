import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Navigation } from "@/components/navigation";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "VEO 대시보드",
    template: "%s | VEO 대시보드"
  },
  description: "구글의 VEO AI 모델을 활용한 고급 비디오 생성 대시보드입니다. 비디오 콘텐츠를 생성해볼 수 있습니다.",
  keywords: ["VEO", "AI 비디오", "비디오 생성", "대시보드", "인공지능", "구글 AI"],
  authors: [{ name: "VEO 대시보드 팀" }],
  creator: "VEO 대시보드",
  publisher: "VEO 대시보드",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://veo.kakao-ai-hackathon-mzc.com'),
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: 'https://veo.kakao-ai-hackathon-mzc.com',
    title: 'VEO 대시보드 - AI 비디오 생성 플랫폼',
    description: '구글의 VEO AI 모델을 활용한 고급 비디오 생성 대시보드입니다. 비디오 콘텐츠를 생성해볼 수 있습니다.',
    siteName: 'VEO 대시보드',
    images: [
      {
        url: 'https://veo.kakao-ai-hackathon-mzc.com/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'VEO 대시보드 - AI 비디오 생성 플랫폼',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VEO 대시보드 - AI 비디오 생성 플랫폼',
    description: '구글의 VEO AI 모델을 활용한 고급 비디오 생성 대시보드입니다. 비디오 콘텐츠를 생성해볼 수 있습니다.',
    images: ['https://veo.kakao-ai-hackathon-mzc.com/twitter-image'],
    creator: '@veodashboard',
  },
  alternates: {
    canonical: 'https://veo.kakao-ai-hackathon-mzc.com/',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white`}
      >
        <Navigation />
        <main className="container mx-auto px-4 py-8 bg-white min-h-screen">
          {children}
        </main>
        <Toaster richColors />
      </body>
    </html>
  );
}
