import { Link } from "wouter";
import { ExternalLink } from "lucide-react";

interface EvidenceLinkProps {
  label: string;
  to: string;
  hash?: string;
  variant?: "subtle" | "outline" | "inline";
  className?: string;
}

export default function EvidenceLink({ label, to, hash, variant = "subtle", className = "" }: EvidenceLinkProps) {
  const href = hash ? `${to}#${hash}` : to;

  const baseClasses = "inline-flex items-center gap-1 text-xs font-medium transition-colors cursor-pointer no-underline";

  const variantClasses = {
    subtle: "text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-2 py-0.5 rounded-full",
    outline: "text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:border-blue-400/50 px-2 py-0.5 rounded-full",
    inline: "text-blue-400 hover:text-blue-300 underline decoration-blue-500/30 hover:decoration-blue-400/50 underline-offset-2",
  };

  return (
    <Link
      href={href}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      data-testid={`evidence-link-${to.replace(/\//g, '-').replace(/^-/, '')}`}
    >
      {label}
      <ExternalLink className="w-3 h-3 opacity-60" />
    </Link>
  );
}
