import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";
import { config } from "./config.js";

export function createDb(url = config.DATABASE_URL) {
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: url,
      max: 10,
      connectionTimeoutMillis: 5000,
    }),
  });
}

@Injectable()
export class Database implements OnModuleInit, OnModuleDestroy {
  readonly client = createDb();
  async onModuleInit() {
    await this.client.$connect();
  }
  async onModuleDestroy() {
    await this.client.$disconnect();
  }
}
