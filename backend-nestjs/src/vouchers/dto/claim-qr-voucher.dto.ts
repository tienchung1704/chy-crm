import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class ClaimQRVoucherDto {
  @IsString()
  @IsNotEmpty()
  orderCode: string;

  @IsUUID()
  @IsNotEmpty()
  voucherId: string;
}
