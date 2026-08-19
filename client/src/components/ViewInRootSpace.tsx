import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface ViewInRootSpaceProps {
  gene?: string;
  className?: string;
}

export default function ViewInRootSpace({ gene, className }: ViewInRootSpaceProps) {
  const href = gene ? `/root-space?gene=${encodeURIComponent(gene)}` : "/root-space";

  return (
    <Link href={href}>
      <Button
        variant="ghost"
        size="sm"
        className={`text-cyan-400 hover:text-cyan-300 hover:bg-slate-800 gap-1.5 ${className ?? ""}`}
        data-testid="button-view-root-space"
      >
        View in Root-Space
        <ArrowRight size={14} />
      </Button>
    </Link>
  );
}
