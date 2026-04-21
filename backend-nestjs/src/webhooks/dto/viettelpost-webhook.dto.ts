import { IsString, IsNumber, IsOptional, IsObject } from 'class-validator';

export class ViettelPostWebhookDto {
  @IsString()
  ORDER_NUMBER: string;

  @IsNumber()
  ORDER_STATUS: number;

  @IsString()
  @IsOptional()
  ORDER_STATUS_NAME?: string;

  @IsString()
  @IsOptional()
  PRODUCT_NAME?: string;

  @IsString()
  @IsOptional()
  RECEIVER_NAME?: string;

  @IsString()
  @IsOptional()
  RECEIVER_PHONE?: string;

  @IsString()
  @IsOptional()
  RECEIVER_ADDRESS?: string;

  @IsNumber()
  @IsOptional()
  MONEY_COLLECTION?: number;

  @IsNumber()
  @IsOptional()
  MONEY_TOTAL?: number;

  @IsString()
  @IsOptional()
  NOTE?: string;

  @IsString()
  @IsOptional()
  UPDATE_DATE?: string;

  @IsObject()
  @IsOptional()
  EXTRA_DATA?: any;
}
