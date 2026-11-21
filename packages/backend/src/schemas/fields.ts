import { z } from "zod";
import { fromDateOnlyString, toDateOnlyString } from "@hokan/shared";
import { int32Schema, nonNegativeInt32Schema, positiveInt32Schema } from "../lib/validation";

export const uuidSchema = z.string().uuid();
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD形式で指定してください")
  .refine((value) => {
    const parsed = fromDateOnlyString(value);
    return !Number.isNaN(parsed.getTime()) && toDateOnlyString(parsed) === value;
  }, "存在する暦日をYYYY-MM-DD形式で指定してください");
export const moneySchema = int32Schema();
export const nonNegativeMoneySchema = nonNegativeInt32Schema();
export const positiveMoneySchema = positiveInt32Schema();
export const name200Schema = z.string().min(1).max(200);
export const text200Schema = z.string().max(200);
export const notesSchema = z.string().max(10_000);
