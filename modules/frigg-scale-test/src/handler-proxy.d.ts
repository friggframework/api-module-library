declare module "services/frigg-scale-test-lambda/src/handler" {
  import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
  export function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2>;
}
