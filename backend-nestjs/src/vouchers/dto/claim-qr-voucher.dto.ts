import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class ClaimQRVoucherDto {
  @IsString()
  @IsNotEmpty()
  orderCode: string;

  @IsUUID()
  @IsOptional()
  voucherId?: string;
}
