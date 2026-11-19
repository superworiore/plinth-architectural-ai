import { createFileRoute } from "@tanstack/react-router";
import { useSmoothScroll } from "@/lib/anim";
import { Nav, FloorRail } from "@/components/plinth/Nav";
import { Cursor } from "@/components/plinth/Cursor";
import { Loader } from "@/components/plinth/Loader";
import { Cinematic } from "@/components/plinth/Cinematic";
import { Vision } from "@/components/plinth/Vision";
import { Story } from "@/components/plinth/Story";
import { Platform } from "@/components/plinth/Platform";
import { Roles } from "@/components/plinth/Roles";
import { Modules } from "@/components/plinth/Modules";
import { ModuleIndex } from "@/components/plinth/ModuleIndex";
import { AIShowcase } from "@/components/plinth/AIShowcase";
import { Showcase3D } from "@/components/plinth/Showcase3D";
import { InteractiveArchitecture } from "@/components/plinth/InteractiveArchitecture";
import { Technology } from "@/components/plinth/Technology";
import { FutureVision } from "@/components/plinth/FutureVision";
import { Footer } from "@/components/plinth/Footer";

const title = "PLINTH — Architecture, computed";
const description =
  "PLINTH is an AI platform that carries a commercial building from bare ground to issued drawings: floor plans, massing, structure, cost, compliance and BOQ in one continuous model.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  useSmoothScroll();

  return (
    <main className="bg-paper">
      <Loader />
      <Cursor />
      <Nav />
      <FloorRail />
      <Cinematic />
      <Vision />
      <Story />
      <Platform />
      <Roles />
      <Modules />
      <ModuleIndex />
      <AIShowcase />
      <Showcase3D />
      <InteractiveArchitecture />
      <Technology />
      <FutureVision />
      <Footer />
    </main>
  );
}
