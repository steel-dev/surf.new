import { Metadata } from "next";

export const metadata: Metadata = {
  title: "~Surf~",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
