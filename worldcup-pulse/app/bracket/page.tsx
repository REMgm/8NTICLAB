import type { Metadata } from "next";
import { getFixtures } from "@/lib/data";
import BracketTree from "@/components/BracketTree";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Knockout Bracket — WorldCup Pulse",
};

export default async function BracketPage() {
  const fixtures = await getFixtures();

  return (
    <>
      <h1 className="display mb-1 text-3xl font-black">The bracket</h1>
      <p className="mb-6 text-sm text-flood-dim">
        Winners&apos; paths draw in team colors. Swipe sideways on mobile, or jump by stage.
      </p>
      <BracketTree fixtures={fixtures} />
    </>
  );
}
