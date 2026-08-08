# RAG Chatbot — Bộ câu hỏi mẫu để đánh giá truy hồi

Dùng để so sánh chất lượng truy hồi trước/sau khi đổi embedding (Giai đoạn 0)
và để chốt giá trị `RAG_SIMILARITY_THRESHOLD` (Giai đoạn 2).

## Cách dùng

- **Câu hỏi theo fixture** (đánh dấu 🧪): trả lời được ngay bằng
  `test/fixtures/rag-corpus/` — dùng để kiểm tra pipeline đúng kỹ thuật
  (parse/chunk/embed/retrieve), không phản ánh chất lượng nội dung thật.
- **Câu hỏi theo corpus thật** (đánh dấu ⏳ chờ corpus thật): nguồn/trang kỳ
  vọng chưa xác nhận được vì `corpus/` chưa có PDF thật — điền lại cột "Nguồn
  kỳ vọng" khi có PDF thật, rồi mới dùng để đánh giá chất lượng thật.

## Câu hỏi trong phạm vi (kỳ vọng trả lời có trích dẫn)

| # | Câu hỏi | Trạng thái | Nguồn kỳ vọng |
|---|---|---|---|
| 1 | GPA tối thiểu là bao nhiêu? | 🧪 fixture | fake-truong-a-de-an-2026.pdf, trang 1 |
| 2 | Điểm SAT tối thiểu để xét tuyển là bao nhiêu? | 🧪 fixture | fake-truong-a-de-an-2026.pdf, trang 2 |
| 3 | Yêu cầu IELTS tối thiểu là gì? | 🧪 fixture | fake-truong-a-de-an-2026.pdf, trang 3 |
| 4 | Học bổng toàn phần cần điều kiện gì? | 🧪 fixture | fake-truong-a-de-an-2026.pdf, trang 4 |
| 5 | Thông tư quy định các trường phải công bố đề án tuyển sinh trước ngày nào? | 🧪 fixture | fake-thong-tu-fake-2026.pdf, trang 2 |
| 6 | VinUni yêu cầu SAT tối thiểu bao nhiêu cho ngành CNTT? | ⏳ chờ corpus thật | Đề án tuyển sinh VinUni 2026 |
| 7 | HUST xét tuyển tài năng cần điều kiện gì? | ⏳ chờ corpus thật | Đề án tuyển sinh HUST 2026 |
| 8 | USTH có yêu cầu phỏng vấn không? | ⏳ chờ corpus thật | Đề án tuyển sinh USTH 2026 |
| 9 | VJU xét tuyển theo phương thức nào? | ⏳ chờ corpus thật | Đề án tuyển sinh VJU 2026 |
| 10 | FPT có học bổng cho học sinh giỏi không? | ⏳ chờ corpus thật | Đề án tuyển sinh FPT 2026 |
| 11 | Swinburne Việt Nam yêu cầu chứng chỉ tiếng Anh gì? | ⏳ chờ corpus thật | Đề án tuyển sinh Swinburne 2026 |
| 12 | Thông tư 06/2026/TT-BGDĐT quy định nguyên tắc xét tuyển chung nào? | ⏳ chờ corpus thật | Thông tư 06/2026/TT-BGDĐT |
| 13 | Học phí VinUni là bao nhiêu? | ⏳ chờ corpus thật | Đề án tuyển sinh VinUni 2026 |
| 14 | HUST có xét tuyển thẳng học sinh giỏi quốc gia không? | ⏳ chờ corpus thật | Đề án tuyển sinh HUST 2026 |
| 15 | Hạn nộp hồ sơ xét tuyển USTH là khi nào? | ⏳ chờ corpus thật | Đề án tuyển sinh USTH 2026 |

## Câu hỏi ngoài phạm vi / match yếu (kỳ vọng bị từ chối) — Giai đoạn 2

| # | Câu hỏi | Kỳ vọng |
|---|---|---|
| 16 | RMIT Việt Nam xét tuyển thế nào? | Từ chối — ngoài Big 6 (fast-path denylist) |
| 17 | Đại học Ngoại thương (FTU) yêu cầu điểm gì? | Từ chối — ngoài Big 6 (fast-path denylist) |
| 18 | Fulbright University Vietnam có học bổng không? | Từ chối — ngoài Big 6 (fast-path denylist) |
| 19 | Công thức tính diện tích hình tròn là gì? | Từ chối — không liên quan gì đến tuyển sinh, dưới ngưỡng liên quan |
| 20 | Thời tiết Hà Nội hôm nay thế nào? | Từ chối — không liên quan, dưới ngưỡng liên quan |
| 21 | VinUni có đội tuyển bóng đá không? | Từ chối hoặc "không tìm thấy" — nhắc đến trường trong Big 6 nhưng câu hỏi không có trong corpus/context, phải dưới ngưỡng liên quan chứ không được bịa |

## Kết quả đánh giá

_(điền sau khi chạy ingest + test thật — Giai đoạn 0 dùng fixture, Giai đoạn 2
dùng để chốt `RAG_SIMILARITY_THRESHOLD`, follow-up dùng corpus thật để có
baseline chất lượng thật)_

| Ngày | Corpus | Embedding model | Threshold | Pass/Fail | Ghi chú |
|---|---|---|---|---|---|
| | | | | | |
