import {
  Controller,
  Post,
  Body,
  Headers,
  UnauthorizedException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { WebhooksService } from './webhooks.service';
import { ViettelPostWebhookDto } from './dto/viettelpost-webhook.dto';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('viettelpost')
  @Public()
  async handleViettelPostWebhook(
    @Body() payload: ViettelPostWebhookDto,
    @Headers('x-viettelpost-token') token: string,
    @Headers('x-viettelpost-signature') signature: string,
  ) {
    this.logger.log(`📨 Received ViettelPost webhook for order: ${payload.ORDER_NUMBER}`);

    // Validate webhook token/signature
    const isValid = await this.webhooksService.validateWebhookToken(token, signature, payload);
    if (!isValid) {
      this.logger.error('❌ Invalid webhook token or signature');
      throw new UnauthorizedException('Invalid webhook credentials');
    }

    try {
      // Process the webhook
      const result = await this.webhooksService.processViettelPostWebhook(payload);
      
      this.logger.log(`✅ Webhook processed successfully for order: ${payload.ORDER_NUMBER}`);
      
      return {
        success: true,
        message: 'Webhook processed successfully',
        data: result,
      };
    } catch (error) {
      this.logger.error(`❌ Error processing webhook: ${error.message}`, error.stack);
      throw new BadRequestException(error.message);
    }
  }
}
