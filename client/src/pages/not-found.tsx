import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-white">404 Page Not Found</h1>
          </div>

          <p className="mt-4 text-sm text-slate-400">
            The page you're looking for doesn't exist.
          </p>

          <Link href="/">
            <Button variant="outline" size="sm" className="mt-4 gap-2" data-testid="link-back-home">
              <ArrowLeft size={14} />
              Back to Home
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
