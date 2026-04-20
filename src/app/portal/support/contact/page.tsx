import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Liên hệ hỗ trợ | Customer CRM',
  description: 'Liên hệ với đội ngũ hỗ trợ khách hàng của Customer CRM',
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="w-[80%] mx-auto">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 md:p-12">
          {/* Header */}
          <div className="mb-8 pb-6 border-b border-gray-200">
            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 mb-4">
              Liên hệ hỗ trợ
            </h1>
            <p className="text-gray-600 text-lg">
              Chúng tôi luôn sẵn sàng hỗ trợ bạn 24/7
            </p>
          </div>

          {/* Content */}
          <div className="space-y-8">
            {/* Contact Methods */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <span className="w-2 h-8 bg-gradient-to-b from-indigo-600 to-purple-600 rounded-full mr-3"></span>
                Các kênh liên hệ
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                {/* Hotline */}
                <div className="bg-gray-50 p-6 rounded-xl border-2 border-blue-200 hover:shadow-lg transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center text-white text-2xl flex-shrink-0">
                      📞
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-blue-900 text-lg mb-2">Hotline</h3>
                      <p className="text-2xl font-bold text-blue-600 mb-2">0987 654 321</p>
                      <p className="text-sm text-gray-700 mb-2">
                        Hỗ trợ khách hàng 24/7
                      </p>
                      <p className="text-xs text-gray-600">
                        Miễn phí cuộc gọi từ tất cả các mạng
                      </p>
                    </div>
                  </div>
                </div>

                {/* Email */}
                <div className="bg-gray-50 p-6 rounded-xl border-2 border-green-200 hover:shadow-lg transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 bg-green-600 rounded-xl flex items-center justify-center text-white text-2xl flex-shrink-0">
                      📧
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-green-900 text-lg mb-2">Email</h3>
                      <p className="text-lg font-bold text-green-600 mb-2">support@customercrm.vn</p>
                      <p className="text-sm text-gray-700 mb-2">
                        Phản hồi trong vòng 2-4 giờ
                      </p>
                      <p className="text-xs text-gray-600">
                        Gửi email bất cứ lúc nào
                      </p>
                    </div>
                  </div>
                </div>

                {/* Live Chat */}
                <div className="bg-gray-50 p-6 rounded-xl border-2 border-purple-200 hover:shadow-lg transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 bg-purple-600 rounded-xl flex items-center justify-center text-white text-2xl flex-shrink-0">
                      💬
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-purple-900 text-lg mb-2">Live Chat</h3>
                      <p className="text-sm text-gray-700 mb-3">
                        Chat trực tiếp với nhân viên hỗ trợ
                      </p>
                      <button className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-purple-700 transition-colors">
                        Bắt đầu chat ngay
                      </button>
                    </div>
                  </div>
                </div>

                {/* Social Media */}
                <div className="bg-gray-50 p-6 rounded-xl border-2 border-orange-200 hover:shadow-lg transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 bg-orange-600 rounded-xl flex items-center justify-center text-white text-2xl flex-shrink-0">
                      📱
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-orange-900 text-lg mb-2">Mạng xã hội</h3>
                      <p className="text-sm text-gray-700 mb-3">
                        Kết nối với chúng tôi trên các nền tảng
                      </p>
                      <div className="flex gap-3">
                        <a href="#" className="text-blue-600 hover:text-blue-700 font-semibold text-sm">Facebook</a>
                        <a href="#" className="text-pink-600 hover:text-pink-700 font-semibold text-sm">Instagram</a>
                        <a href="#" className="text-blue-500 hover:text-blue-600 font-semibold text-sm">Twitter</a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Office Location */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <span className="w-2 h-8 bg-gradient-to-b from-indigo-600 to-purple-600 rounded-full mr-3"></span>
                Địa chỉ văn phòng
              </h2>
              <div className="bg-gray-50 p-8 rounded-xl border border-gray-200">
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg mb-4 flex items-center gap-2">
                      <span className="text-2xl">🏢</span>
                      Trụ sở chính
                    </h3>
                    <div className="space-y-3 text-gray-700">
                      <p className="flex items-start gap-2">
                        <span className="font-semibold min-w-[80px]">Địa chỉ:</span>
                        <span>72 Trần Đăng Ninh, Cầu Giấy, Hà Nội</span>
                      </p>
                      <p className="flex items-start gap-2">
                        <span className="font-semibold min-w-[80px]">Điện thoại:</span>
                        <span>0987 654 321</span>
                      </p>
                      <p className="flex items-start gap-2">
                        <span className="font-semibold min-w-[80px]">Email:</span>
                        <span>support@customercrm.vn</span>
                      </p>
                      <p className="flex items-start gap-2">
                        <span className="font-semibold min-w-[80px]">Giờ làm việc:</span>
                        <span>8:00 - 18:00 (Thứ 2 - Thứ 6)<br/>8:00 - 12:00 (Thứ 7)</span>
                      </p>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-gray-900 text-lg mb-4 flex items-center gap-2">
                      <span className="text-2xl">🚗</span>
                      Hướng dẫn đến
                    </h3>
                    <div className="space-y-2 text-sm text-gray-700">
                      <p>• <strong>Xe bus:</strong> Tuyến 03, 23, 34 - Dừng Trần Đăng Ninh</p>
                      <p>• <strong>Taxi/Grab:</strong> Nhập địa chỉ "72 Trần Đăng Ninh"</p>
                      <p>• <strong>Xe máy:</strong> Có bãi đỗ xe miễn phí</p>
                      <p>• <strong>Ô tô:</strong> Bãi đỗ xe trong tòa nhà</p>
                    </div>
                  </div>
                </div>

                {/* Map placeholder */}
                <div className="mt-6 bg-gray-200 rounded-xl h-64 flex items-center justify-center">
                  <p className="text-gray-500">🗺️ Bản đồ Google Maps</p>
                </div>
              </div>
            </section>

            {/* FAQ */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <span className="w-2 h-8 bg-gradient-to-b from-indigo-600 to-purple-600 rounded-full mr-3"></span>
                Câu hỏi thường gặp
              </h2>
              <div className="space-y-4">
                <details className="bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-indigo-300 transition-colors">
                  <summary className="font-semibold text-gray-900 cursor-pointer">
                    Làm thế nào để theo dõi đơn hàng của tôi?
                  </summary>
                  <p className="mt-3 text-sm text-gray-700 leading-relaxed">
                    Bạn có thể theo dõi đơn hàng bằng cách đăng nhập vào tài khoản, truy cập mục "Đơn hàng của tôi" và xem chi tiết trạng thái đơn hàng. Bạn cũng sẽ nhận được email và SMS thông báo khi đơn hàng thay đổi trạng thái.
                  </p>
                </details>

                <details className="bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-indigo-300 transition-colors">
                  <summary className="font-semibold text-gray-900 cursor-pointer">
                    Tôi có thể đổi trả sản phẩm trong bao lâu?
                  </summary>
                  <p className="mt-3 text-sm text-gray-700 leading-relaxed">
                    Bạn có thể đổi trả sản phẩm trong vòng 7 ngày kể từ ngày nhận hàng (miễn phí), hoặc trong vòng 15 ngày (có phí xử lý 10%). Sản phẩm phải còn nguyên tem mác và chưa qua sử dụng.
                  </p>
                </details>

                <details className="bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-indigo-300 transition-colors">
                  <summary className="font-semibold text-gray-900 cursor-pointer">
                    Làm thế nào để tích điểm thưởng?
                  </summary>
                  <p className="mt-3 text-sm text-gray-700 leading-relaxed">
                    Mỗi 10.000 VNĐ thanh toán thành công sẽ được tích 1 điểm. Điểm được cộng tự động sau khi đơn hàng hoàn thành. Bạn cũng có thể tích điểm qua các hoạt động như đánh giá sản phẩm, giới thiệu bạn bè, v.v.
                  </p>
                </details>

                <details className="bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-indigo-300 transition-colors">
                  <summary className="font-semibold text-gray-900 cursor-pointer">
                    Phí vận chuyển được tính như thế nào?
                  </summary>
                  <p className="mt-3 text-sm text-gray-700 leading-relaxed">
                    Phí vận chuyển phụ thuộc vào giá trị đơn hàng và khu vực giao hàng. Đơn hàng từ 300.000đ được miễn phí ship nội thành HN/HCM, từ 500.000đ miễn phí ship toàn quốc. Xem chi tiết tại trang Chính sách giao hàng.
                  </p>
                </details>

                <details className="bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-indigo-300 transition-colors">
                  <summary className="font-semibold text-gray-900 cursor-pointer">
                    Tôi quên mật khẩu, phải làm sao?
                  </summary>
                  <p className="mt-3 text-sm text-gray-700 leading-relaxed">
                    Tại trang đăng nhập, nhấn vào "Quên mật khẩu", nhập email đã đăng ký. Chúng tôi sẽ gửi link đặt lại mật khẩu đến email của bạn trong vòng vài phút.
                  </p>
                </details>
              </div>
            </section>

            {/* Contact Form */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <span className="w-2 h-8 bg-gradient-to-b from-indigo-600 to-purple-600 rounded-full mr-3"></span>
                Gửi tin nhắn cho chúng tôi
              </h2>
              <div className="bg-gray-50 p-8 rounded-xl border border-gray-200">
                <form className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Họ và tên <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-colors"
                        placeholder="Nhập họ và tên"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-colors"
                        placeholder="email@example.com"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Số điện thoại <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-colors"
                        placeholder="0987 654 321"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Chủ đề
                      </label>
                      <select className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-colors">
                        <option>Hỗ trợ đơn hàng</option>
                        <option>Hỏi về sản phẩm</option>
                        <option>Khiếu nại</option>
                        <option>Góp ý</option>
                        <option>Khác</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Nội dung <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={6}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-colors resize-none"
                      placeholder="Nhập nội dung tin nhắn của bạn..."
                    ></textarea>
                  </div>

                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="agree" className="w-4 h-4" />
                    <label htmlFor="agree" className="text-sm text-gray-700">
                      Tôi đồng ý với <a href="/portal/policies/privacy" className="text-indigo-600 hover:underline">chính sách bảo mật</a>
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 transition-colors"
                  >
                    Gửi tin nhắn
                  </button>
                </form>
              </div>
            </section></div>
        </div>
      </div>
    </div>
  );
}


