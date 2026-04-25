Bước 1: Cài đặt thư viện cần thiết
Trong project NestJS của bạn, cài đặt TypeORM, MySQL driver, HTTP Module (để gọi API Zalo) và Schedule Module (để chạy Cronjob làm mới token):

Bash
npm install @nestjs/typeorm typeorm mysql2 @nestjs/axios axios @nestjs/schedule
Trong app.module.ts, đảm bảo bạn đã import ScheduleModule.forRoot() và cấu hình TypeOrmModule kết nối tới MySQL.

Bước 2: Thiết kế Database Entities (TypeORM)
Tạo thư mục src/zalo. Khai báo 2 bảng zalo_tokens và zns_logs.

1. Entity Token (src/zalo/entities/zalo-token.entity.ts)

TypeScript
import { Entity, Column, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('zalo_tokens')
export class ZaloToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  app_id: string;

  @Column({ type: 'text' })
  access_token: string;

  @Column({ type: 'text' })
  refresh_token: string;

  @Column({ type: 'datetime' })
  expires_at: Date; // Thời điểm access_token hết hạn (thường là sau 25 giờ)

  @UpdateDateColumn()
  updated_at: Date;
}
2. Entity Logs (src/zalo/entities/zns-log.entity.ts)

TypeScript
import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity('zns_logs')
export class ZnsLog {
  @PrimaryColumn()
  tracking_id: string; // Mã đơn hàng / mã giao dịch của bạn

  @Column()
  phone: string;

  @Column()
  template_id: string;

  @Column({ default: 'pending' }) // pending, success, failed
  status: string;

  @Column({ nullable: true })
  zalo_message_id: string;

  @Column({ type: 'text', nullable: true })
  error_message: string;

  @CreateDateColumn()
  created_at: Date;
}
Bước 3: Viết Zalo Service (Core Logic & Cronjob)
Đây là "trái tim" của hệ thống. File này sẽ chứa hàm gửi ZNS và 1 Cronjob tự động refresh token.

src/zalo/zalo.service.ts

TypeScript
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { Cron, CronExpression } from '@nestjs/schedule';
import { firstValueFrom } from 'rxjs';
import { ZaloToken } from './entities/zalo-token.entity';
import { ZnsLog } from './entities/zns-log.entity';

@Injectable()
export class ZaloService {
  private readonly logger = new Logger(ZaloService.name);

  // Lấy từ biến môi trường (.env)
  private readonly appId = process.env.ZALO_APP_ID;
  private readonly secretKey = process.env.ZALO_SECRET_KEY;

  constructor(
    @InjectRepository(ZaloToken)
    private tokenRepo: Repository<ZaloToken>,
    @InjectRepository(ZnsLog)
    private logRepo: Repository<ZnsLog>,
    private readonly httpService: HttpService,
  ) {}

  /**
   * CRONJOB: Tự động làm mới Access Token mỗi 20 tiếng
   * Access Token Zalo sống 25 tiếng. Chạy mỗi 20 tiếng để đảm bảo luôn an toàn.
   */
  @Cron('0 */20 * * *') // Hoặc dùng CronExpression.EVERY_12_HOURS
  async handleRefreshToken() {
    this.logger.log('Đang chạy Cronjob Refresh Zalo Token...');
    
    // Lấy token hiện tại từ DB
    const currentToken = await this.tokenRepo.findOne({ where: { app_id: this.appId } });
    if (!currentToken || !currentToken.refresh_token) {
      this.logger.error('Không tìm thấy Refresh Token trong DB. Hãy thêm thủ công lần đầu!');
      return;
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          'https://oauth.zaloapp.com/v4/oa/access_token',
          new URLSearchParams({
            app_id: this.appId,
            grant_type: 'refresh_token',
            refresh_token: currentToken.refresh_token,
          }).toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'secret_key': this.secretKey, // Zalo bắt buộc gửi secret_key ở header
            },
          },
        ),
      );

      const data = response.data;
      
      // Update vào MySQL
      currentToken.access_token = data.access_token;
      currentToken.refresh_token = data.refresh_token;
      
      // Cập nhật thời gian hết hạn (data.expires_in thường là 90000 giây = 25 giờ)
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + parseInt(data.expires_in));
      currentToken.expires_at = expiresAt;

      await this.tokenRepo.save(currentToken);
      this.logger.log('Refresh Zalo Token thành công!');
      
    } catch (error) {
      this.logger.error('Lỗi khi Refresh Token:', error.response?.data || error.message);
    }
  }

  /**
   * Hàm gọi API gửi ZNS Zalo
   */
  async sendZnsMessage(phone: string, templateId: string, templateData: any, trackingId: string) {
    // 1. Format số điện thoại (bỏ số 0, thêm 84)
    let formattedPhone = phone;
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '84' + formattedPhone.slice(1);
    }

    // 2. Ghi Log vào DB với trạng thái Pending
    const log = this.logRepo.create({
      tracking_id: trackingId,
      phone: formattedPhone,
      template_id: templateId,
      status: 'pending',
    });
    await this.logRepo.save(log);

    // 3. Lấy Access Token sống
    const tokenRecord = await this.tokenRepo.findOne({ where: { app_id: this.appId } });
    if (!tokenRecord || new Date() > tokenRecord.expires_at) {
      log.status = 'failed';
      log.error_message = 'Access Token không tồn tại hoặc đã hết hạn';
      await this.logRepo.save(log);
      throw new Error('Zalo Token Error');
    }

    // 4. Bắn API sang Zalo ZNS
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          'https://business.openapi.zalo.me/message/template',
          {
            phone: formattedPhone,
            template_id: templateId,
            template_data: templateData,
            tracking_id: trackingId,
          },
          {
            headers: {
              'access_token': tokenRecord.access_token,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const result = response.data;

      // 5. Cập nhật Log dựa trên kết quả
      if (result.error === 0) {
        log.status = 'success';
        log.zalo_message_id = result.data.message_id;
      } else {
        log.status = 'failed';
        log.error_message = `[${result.error}] ${result.message}`;
      }
      
      await this.logRepo.save(log);
      return result;

    } catch (error) {
      log.status = 'failed';
      log.error_message = error.response?.data?.message || error.message;
      await this.logRepo.save(log);
      throw error;
    }
  }
}
Bước 4: Viết Controller xử lý Request
Tạo Endpoint để các ứng dụng khác (Web, App) có thể gọi vào hệ thống của bạn để kích hoạt việc bắn ZNS.

src/zalo/zalo.controller.ts

TypeScript
import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { ZaloService } from './zalo.service';

@Controller('api/zalo')
export class ZaloController {
  constructor(private readonly zaloService: ZaloService) {}

  @Post('send-zns')
  async sendZns(
    @Body() body: { 
      phone: string; 
      template_id: string; 
      template_data: any; 
      tracking_id: string; 
    }
  ) {
    const { phone, template_id, template_data, tracking_id } = body;

    if (!phone || !template_id || !template_data || !tracking_id) {
      throw new HttpException('Thiếu tham số bắt buộc', HttpStatus.BAD_REQUEST);
    }

    try {
      const result = await this.zaloService.sendZnsMessage(
        phone, 
        template_id, 
        template_data, 
        tracking_id
      );
      
      return {
        success: result.error === 0,
        data: result
      };
    } catch (error) {
      throw new HttpException({
        success: false,
        message: 'Lỗi server khi gửi ZNS',
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
Bước 5: Đóng gói Zalo Module
Khai báo toàn bộ vào Module để NestJS khởi tạo.

src/zalo/zalo.module.ts

TypeScript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ZaloService } from './zalo.service';
import { ZaloController } from './zalo.controller';
import { ZaloToken } from './entities/zalo-token.entity';
import { ZnsLog } from './entities/zns-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ZaloToken, ZnsLog]),
    HttpModule,
  ],
  controllers: [ZaloController],
  providers: [ZaloService],
  exports: [ZaloService], // Export nếu các Module khác (Order, Auth) muốn dùng trực tiếp ZaloService
})
export class ZaloModule {}
🚀 Hành động đầu tiên bạn cần làm sau khi copy code:
Bạn không thể tự động chạy Cronjob nếu trong Database chưa có data ban đầu. Hãy vào MySQL, mở bảng zalo_tokens, thêm thủ công (Insert) một dòng dữ liệu duy nhất chứa app_id, access_token, và refresh_token mà bạn vừa xin được từ Postman (theo tài liệu Zalo). Từ đó trở đi, NestJS Cronjob sẽ tự động đọc, đi xin token mới và ghi đè lại giúp bạn mãi mãi!