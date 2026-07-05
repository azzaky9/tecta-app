import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button } from "tecta";

export const Default = () => (
  <Card style={{ width: 320 }}>
    <CardHeader>
      <CardTitle>Upgrade to Pro</CardTitle>
      <CardDescription>Unlock every feature and remove limits.</CardDescription>
    </CardHeader>
    <CardContent>
      <p style={{ margin: 0, fontSize: 14 }}>Billed monthly, cancel anytime.</p>
    </CardContent>
    <CardFooter>
      <Button>Upgrade</Button>
    </CardFooter>
  </Card>
);
