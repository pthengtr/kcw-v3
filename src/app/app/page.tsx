import { createServer } from "@/lib/supabase/server";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";

export default async function AppHome() {
  const supabase = await createServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = user?.email ?? "unknown";
  const initials = email?.[0]?.toUpperCase() ?? "U";

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">KCW v3</h1>
            <p className="text-sm text-muted-foreground">
              Signed in as <span className="font-medium">{email}</span>
            </p>
          </div>
        </div>

        <form action="/auth/signout" method="post">
          <Button variant="outline">Sign out</Button>
        </form>
      </div>

      <Separator />

      {/* Quick stats / environment */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Environment</CardDescription>
            <CardTitle className="text-lg">Development</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Badge variant="secondary">App Router</Badge>
            <Badge variant="secondary" className="ml-2">
              Supabase Auth
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Auth</CardDescription>
            <CardTitle className="text-lg">Active session</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground">
              You’re authenticated. Middleware guards <code>/app/*</code>.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Next steps</CardDescription>
            <CardTitle className="text-lg">Domain setup</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground">
              Add party & product schemas, then pricing/inventory.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Domain shortcuts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Core Domains</CardTitle>
            <CardDescription>Foundational data</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            <Link href="/app/party">
              <Button variant="secondary" className="w-full justify-start">
                Party
              </Button>
            </Link>
            <Link href="/app/product">
              <Button variant="secondary" className="w-full justify-start">
                Product
              </Button>
            </Link>
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground">
            Keep write logic inside each domain only.
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Operational Domains</CardTitle>
            <CardDescription>Compose from core</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            <Link href="/app/pricing">
              <Button variant="secondary" className="w-full justify-start">
                Pricing
              </Button>
            </Link>
            <Link href="/app/inventory">
              <Button variant="secondary" className="w-full justify-start">
                Inventory
              </Button>
            </Link>
            <Link href="/app/purchasing">
              <Button variant="secondary" className="w-full justify-start">
                Purchasing
              </Button>
            </Link>
            <Link href="/app/sales">
              <Button variant="secondary" className="w-full justify-start">
                Sales
              </Button>
            </Link>
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground">
            No upward dependencies; reads via views, writes via domain APIs.
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
