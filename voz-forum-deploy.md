# voz-forum — web forum dựng trên API voz.vn

Website diễn đàn theo phong cách voz.vn, chạy trên Vercel Edge (region **sin1 — Singapore**),
dùng REST API của voz.vn làm backend. Không có database riêng: mọi dữ liệu đọc/ghi trực tiếp
qua API, phiên đăng nhập lưu trong cookie mã hoá base64url.

> **Ghi chú về dữ liệu cá nhân.** Tài liệu này **không** chứa username, user id, member id,
> conversation id, thread id, post id, attachment id hay nội dung bài viết thật của bất kỳ
> thành viên nào. Mọi ví dụ dùng placeholder dạng `<slug>`, `<thread_id>`, `<post_id>`,
> `<user_id>`, `<conversation_id>`, `<attach_id>`. Khi thêm ví dụ mới, giữ nguyên quy tắc
> này: không dán URL voz.vn thật, không dán id thật, không dán nội dung bài viết thật.
> Hằng số kỹ thuật của ứng dụng (`client_id`, guest API key, region, scope) **được giữ lại**
> vì cần cho việc deploy và không phải thông tin cá nhân.

```
vtest/
├── api/
│   ├── [...path].js      # Edge Function: proxy /api/xf/* + OAuth endpoints
│   └── index.js          # re-export cho route /api
├── public/
│   ├── index.html        # shell (History API router)
│   ├── assets/
│   │   ├── app.js        # entry: global listeners + boot
│   │   ├── api.js        # client gọi /api/xf/*
│   │   ├── core/         # hạ tầng dùng chung
│   │   │   ├── dom.js        # handle DOM + state toàn cục
│   │   │   ├── icons.js      # SVG inline
│   │   │   ├── utils.js      # esc / num / timeAgo / fullDate
│   │   │   ├── paths.js      # slug + URL giống voz.vn
│   │   │   ├── nav.js        # navigate / currentPage
│   │   │   └── router.js     # parsePath + route
│   │   ├── lib/          # logic thuần, không đụng DOM
│   │   │   ├── avatar.js     # avatarMarkup + fallback chữ cái
│   │   │   ├── bbcode.js     # sanitize + khôi phục size ảnh + quote
│   │   │   ├── postLinks.js  # link voz.vn trong bài → route nội bộ
│   │   │   ├── signature.js  # chữ ký (BBCode thô) → HTML
│   │   │   ├── editorCodec.js # BBCode ⇄ HTML cho trình soạn
│   │   │   ├── media.js      # khôi phục iframe/media + resize Reddit + Flickr oEmbed
│   │   │   ├── imageFallback.js # data-onerror (hide-parent/hide) — sự kiện error pha capture
│   │   │   ├── prefix.js     # prefix_id → class màu
│   │   │   ├── quotes.js     # khôi phục link nguồn của quote
│   │   │   ├── attachments.js # [ATTACH]id → URL thật cho trình soạn
│   │   │   ├── smilies.js    # danh mục /voz/smilies → <img>
│   │   │   ├── stickers.js   # album sticker + recent (localStorage)
│   │   │   ├── imgurImport.js # tách album id + tải album imgur
│   │   │   ├── pikUpload.js  # nén + tải ảnh lên pik.vn qua proxy
│   │   │   ├── spoilers.js   # parser BBCode → details/summary
│   │   │   ├── unread.js     # bài chưa đọc đầu tiên (visitor_read_date → page/id)
│   │   │   └── userBadges.js # User.banners → badge màu
│   │   ├── ui/           # component render HTML
│   │   │   ├── chrome.js     # header account / breadcrumbs / nav
│   │   │   ├── headerMenus.js # dropdown tìm kiếm / hộp thư / thông báo
│   │   │   ├── forumNodes.js # nhóm diễn đàn, khối diễn đàn con + bài mới nhất
│   │   │   ├── feedback.js   # toast / loading / errorBox
│   │   │   ├── pagination.js # pageNav + ô nhảy trang
│   │   │   ├── infiniteScroll.js # cuộn liên tục (Bật / Theo yêu cầu / Tắt)
│   │   │   ├── threadRow.js  # 1 dòng danh sách chủ đề
│   │   │   ├── post.js       # 1 bài viết (.message)
│   │   │   ├── reactions.js  # nút cảm xúc + dải tên
│   │   │   ├── editor.js     # textarea BBCode + toolbar
│   │   │   ├── editorTools.js # bảng chèn (URL/ảnh/media/bảng/smilie/sticker)
│   │   │   ├── stickerPicker.js # popup chọn sticker (tab album + gần đây)
│   │   │   ├── memberTooltip.js # thẻ thành viên hover/chạm
│   │   │   ├── titleHold.js  # giữ tiêu đề 1,5 s để theo dõi
│   │   │   ├── unreadCounts.js # badge hộp thư / thông báo
│   │   │   ├── inlineEdit.js # sửa bài tại chỗ (không modal)
│   │   │   ├── modal.js      # modal shell + báo cáo
│   │   │   ├── theme.js      # áp data-theme (sáng/tối/auto) + cỡ chữ + nạp font lười
│   │   │   ├── chromeAutoHide.js # ẩn/hiện header + nav theo hướng cuộn
│   │   │   └── session.js    # loadSession / requireLogin
│   │   ├── views/        # 1 file / nhóm route
│   │   │   ├── forum.js      # trang chủ + danh sách chủ đề + bài mới
│   │   │   ├── thread.js     # chủ đề + trả lời + mọi action
│   │   │   ├── compose.js    # tạo chủ đề + chọn tiền tố
│   │   │   ├── search.js
│   │   │   ├── dm.js         # hộp thư / hội thoại / soạn mới
│   │   │   ├── lists.js      # thông báo / đánh dấu / theo dõi
│   │   │   ├── user.js
│   │   │   ├── settings.js  # /cai-dat-tuivoz — giao diện + phím tắt nav + sticker + JSON backup
│   │   │   └── login.js
│   │   ├── fonts/        # woff2 (roboto / be-vietnam-pro / be-vietnam) + OFL.txt, OFL-BeVietnam.txt
│   │   ├── img/          # voz-lockup.svg — logo header, chép từ voz.vn
│   │   └── css/          # theme, tách theo khu vực
│   │       ├── base.css      # bảng màu sáng + bảng tối + reset + utility + token cỡ chữ
│   │       ├── theme.css     # color-scheme, giảm sáng ảnh, selection
│   │       ├── layout.css    # header / nav / block / footer
│   │       ├── forum.css     # node list / structItem / pageNav
│   │       ├── avatar.css    # avatar + label tiền tố
│   │       ├── post.css      # .message + bbWrapper (chữ trong bài theo --post-scale)
│   │       ├── media.css     # unfurl (ghim chặt ảnh/icon) + iframe media
│   │       ├── reaction.css
│   │       ├── forms.css     # button / input / tabs
│   │       ├── editor.css    # trình soạn trực quan
│   │       ├── account.css   # DM / alert / profile / login
│   │       ├── misc.css      # toast / modal / loading
│   │       ├── responsive.css
│   │       ├── headerMenus.css
│   │       ├── home.css
│   │       ├── settings.css   # trang cài đặt + danh sách phím tắt + thanh trượt cỡ chữ
│   │       ├── stickers.css   # popup sticker + quản lý album
│   │       └── fonts.css      # @font-face — chỉ được link khi người dùng chọn phông
│   └── userscript/
│       └── voz-oauth-helper.user.js
├── tools/
│   └── build-fonts.py    # dựng woff2 từ font OFL gốc (instance + subset)
├── dev-server.mjs        # server local (không deploy)
├── package.json
├── vercel.json
├── LICENSE               # GPL-3.0
├── voz-app-api.md        # tài liệu API voz.vn (tham chiếu)
└── voz-forum-deploy.md   # tài liệu này
```

Thứ tự thẻ `<link>` trong `index.html` quan trọng: `base.css` (biến màu) phải đứng đầu,
ngay sau là `theme.css` (rule theo `data-theme`/`data-font`) và script chống nhấp nháy
(đặt `data-theme`/`--font`/`--post-scale`/`--ui-scale` trước lần vẽ đầu);
`responsive.css` chứa override chung; `headerMenus.css` và `home.css` đứng sau để giữ layout responsive riêng cho menu và trang chủ.
`editor.css` phải đứng **sau** `forms.css` vì nó ghi đè `.editor-toolbar`; `media.css`
đứng ngay sau `post.css` để style unfurl/iframe nằm cạnh style bài viết. `settings.css` và
`stickers.css` đứng cuối vì chỉ phục vụ `/cai-dat-tuivoz` và popup sticker.

### Giao diện trang chủ và header

- `ui/forumNodes.js` dựng nhóm diễn đàn, icon hội thoại/tìm kiếm, số chủ đề/bài viết và chủ đề mới nhất cùng người bình luận cuối. SearchForum (Tin tức iNet, Review sản phẩm, Chia sẻ kiến thức) trỏ về route nội bộ `/s/<slug>.<id>/` giống voz.vn, không mở sang voz.vn nữa. Trên trang một diễn đàn, `subForumBlock()` còn dựng **khối diễn đàn con** — voz.vn xếp các node con thành một `.block` **không có tiêu đề** ngay trên danh sách chủ đề, tái dùng đúng `nodeRow()` của trang chủ (icon, tiêu đề, số chủ đề/bài viết, avatar + chủ đề mới nhất). `/forums/{id}` không trả node con nên khối này lấy từ `/nodes/` (`tree_map`), tận dụng cache `state.nodes`. Diễn đàn không có node con thì không render gì.
- `ui/headerMenus.js` quản lý menu tìm kiếm, hộp thư và thông báo; tải tối đa 6 mục khi mở, có liên kết xem tất cả. Escape/click bên ngoài đóng menu. Menu tài khoản chứa hồ sơ, đánh dấu, theo dõi và nút Đăng xuất kèm icon nguồn; không còn nút đăng xuất riêng trên thanh header.
- `ui/unreadCounts.js` hiển thị badge đỏ trên icon hộp thư/thông báo, lấy tổng từ `GET /conversations/?unread=true` và `GET /alerts/?unviewed=true` (không đếm riêng trang đầu). Số 0 ẩn badge, trên 99 hiện `99+`; accessible label giữ số đầy đủ. Cập nhật khi render tài khoản, chuyển trang xong, tải menu xong, quay lại tab và mỗi 60 giây khi tab hiển thị. Mở menu thông báo gọi `POST /alerts/mark-all` với `viewed=true`; mở hộp thư đánh dấu các hội thoại chưa đọc đang hiển thị qua `POST /conversations/{id}/mark-read` tới `last_message_date` (không đánh dấu hội thoại ngoài preview). Mục mới có nền cam nhạt suốt lần mở đó, mở lại dùng trạng thái API mới. Sau thao tác đọc, bắt buộc tải lại count sau request count đang chạy để tránh số cũ; API lỗi không giả lập xóa badge.
- Tìm kiếm hỗ trợ từ khoá **hoặc** bài viết của một thành viên. API không áp dụng `title_only`/`users` trên tìm từ khoá; tìm nâng cao đầy đủ mở voz.vn, không giả lập bộ lọc bị bỏ qua.
- `views/compose.js` xử lý `/f/<slug>.<id>/post-thread`, kiểm tra quyền và lấy tiền tố từ API. Nút đăng gửi dữ liệu thật lên voz.vn; không dùng nút này để kiểm tra trên dữ liệu thật. Diễn đàn yêu cầu trường đặc biệt mở composer trên voz.vn.
- Nút Tạo chủ đề mới nằm cùng hàng breadcrumb của diễn đàn, kể cả trên mobile; breadcrumb dài tự xuống dòng trong phần bên trái.
- Trên mobile ≤620px, thống kê Bài viết / Điểm / Tham gia hiển thị bên phải tên và badge tác giả; số lượng rút gọn K/M, ngày tham gia hiển thị năm.
- Phân trang cuối danh sách chủ đề dùng `.block-outer` trong suốt giống trang chủ đề.
- Chủ đề có bài mới chưa đọc in đậm tiêu đề (`font-weight: 600`), đọc rồi trở về 400 — giống voz.vn. API `/forums/{id}/threads` trả sẵn `is_unread` (kèm `first_unread_snippet`, `visitor_read_date`) theo tài khoản đang đăng nhập, nên không cần gọi thêm endpoint: `ui/threadRow.js` thêm class `is-unread` và `css/forum.css` lo phần in đậm, nhãn tiền tố vẫn giữ 400. Cơ chế `is-unread` này dùng chung với trang chủ (`node-row`) và hộp thư (`dm-row`).
- **Nhảy tới bài chưa đọc.** Tiêu đề của chủ đề `is_unread` trỏ `/t/<slug>.<id>/unread` — đúng dạng link voz.vn đặt trong `structItem-title` — rồi `router.js` phân giải thành `/t/…/page-N/#post-<id>` và `replaceState`, y như redirect phía server của voz.vn. API **không** có "id bài chưa đọc đầu tiên": `/threads/{id}/posts` không lọc theo trạng thái đọc và `/threads/{id}/?unread=1` bị bỏ qua. Bù lại `GET /threads/{id}/` trả `visitor_read_date` + `pagination` **mà không** đánh dấu đã đọc, nên `lib/unread.js` (`resolveUnread`) đi ngược từ trang cuối, gặp trang đầu tiên có bài mới hơn `visitor_read_date` là dừng — chủ đề dài thường chỉ tốn 1–2 request. `visitor_read_date: null` (chưa từng mở) ⇒ về trang 1, không gắn fragment. Chặn trần `MAX_PAGE_WALKS` 12 lần để chủ đề bất thường không nối request vô hạn; lỗi mạng giữ kết quả trang đã phân giải được. Thread đã đọc hết ⇒ về trang 1, không fragment (không sinh `#post-null`).
- Trạng thái đọc chỉ được xoá khi mở bài ở **trang cuối** (`viewThread` gọi `POST /threads/{id}/mark-read` với `date` hiện tại, bỏ qua lỗi); mở trang giữa không đánh dấu đã đọc. Chỉ chạy khi đã đăng nhập và thread đang `is_unread`. Lưu ý `GET /threads/{id}/` **không** tự đánh dấu đã đọc — chỉ POST `mark-read` mới đổi `is_unread`.
- Avatar mặc định giữ bảng màu hiện tại; chữ cái bằng 60% chiều rộng avatar (`60cqi`).
- Thời gian đăng bài trong chủ đề dùng dạng tương đối đến hết ngày thứ 7; từ 8 ngày hiển thị ngày giờ đầy đủ. Hover thời gian luôn xem được ngày giờ chính xác. Trên mobile ≤620px, chạm thời gian sẽ đổi thành ngày giờ đầy đủ tại chỗ, không chuyển đến permalink bài viết; liên kết số bài vẫn hoạt động. Các định dạng thời gian ở khu vực khác giữ nguyên.
- API thay nội dung spoiler bằng `Spoiler content hidden.`; `lib/spoilers.js` lấy lại nội dung từ BBCode gốc bằng parser stack, dựng `details/summary` hỗ trợ spoiler lồng nhau. Giữ các định dạng cơ bản, list, URL, ảnh/attachment, code, quote và media; EMBED chưa hỗ trợ giữ liên kết nguồn. Chỉ thay placeholder khi số spoiler ngoài cùng khớp, không tải HTML ngoài hay chạy BBCode như HTML. Nội dung phục hồi tiếp tục đi qua sanitizer, khôi phục quote/media/smiley và kích thước ảnh.
- `lib/quotes.js` khôi phục liên kết bài gốc trong tên tác giả quote từ BBCode (bao gồm quote lồng nhau); quote không có post ID giữ tên thường. Route `/p/<id>/` lấy bài gốc và pagination API để chuyển đến đúng thread/trang rồi cuộn tới bài, không giả định 20 bài/trang.
- `css/media.css` định dạng preview URL (`bbCodeBlock--unfurl`) từ HTML API: thumbnail, tiêu đề, mô tả, favicon; ảnh preview không nhận class ảnh bài viết. Không tự fetch URL tùy ý để lấy metadata. Khối embed (`.media-embed`) canh giữa bằng `margin: 12px auto` để video không dạt trái so với voz.vn.
  - **Bẫy specificity (đã sửa).** `.bbWrapper img:not(.smilie)` ở `post.css` đặt `height: auto` với specificity (0,2,1), thắng `.bbCodeBlockUnfurl-icon` (0,2,0). Favicon tải lỗi có `naturalHeight = 0`, nên `height: auto` + `width: 16px` biến alt text (`discord.com`) thành một cột chữ 16px cao hàng trăm pixel: card từ ~130px phình lên ~400px, và vì chữ trong bài co giãn theo `--post-scale` nên lỗi nặng dần khi tăng cỡ chữ (100% → 397px, 150% → 397px, 200% → lớn hơn nữa). Hai ảnh của card giờ được ghim qua chính hàng của chúng — `.contentRow-figure .bbCodeBlockUnfurl-image` và `.contentRow-minor .bbCodeBlockUnfurl-icon`, đều (0,3,0) — nên thắng rule chung mà **không** phụ thuộc tổ tiên `.bbWrapper` (card vẫn đúng khi render ngoài `.bbWrapper`). Icon còn có `max-height: 16px` làm lớp bảo hiểm. Đo lại: card 131px ở 100%, 206px ở 150%, 306px ở 200% — chênh lệch chỉ do chữ, không do ảnh.
  - **`data-onerror="hide-parent"` (đã hiện thực).** HTML của voz.vn gắn thuộc tính này lên favicon; bản thân nó là **trơ** — XenForo bind bằng JavaScript mà app không tải — nên favicon chết vẫn chiếm chỗ và hiện alt text. `lib/imageFallback.js` (`wireImageFallbacks()`, gọi một lần trong `app.js`) bắt `error` ở **pha capture** trên `document` (sự kiện `error` không bubble) và ẩn phần tử cha (`hide-parent`) hoặc chính ảnh (`hide`). Ảnh không có `data-onerror` không bị đụng tới. Chỉ favicon chết mới ẩn; ảnh preview 1×1 vẫn được kéo đầy khung 80/60px với `object-fit: cover`.
- `lib/media.js` khôi phục wrapper media của API: YouTube, X/Twitter, TikTok, Reddit (`subreddit/comments/id`) và Imgur (`[MEDIA=imgur]<album_id>[/MEDIA]` → `https://imgur.com/<id>/embed`) được dựng iframe từ ID đã kiểm tra, có liên kết mở nguồn. Iframe sẵn có chỉ được giữ khi khớp HTTPS host/path cho YouTube, Vimeo, Dailymotion, Facebook plugins, Spotify, SoundCloud, TikTok, Twitter hoặc Imgur (`/^\/[\w-]+\/embed\/?$/`). Mọi thuộc tính iframe được dựng lại, loại `srcdoc`/event handler và áp sandbox; script bên ngoài không được chèn. Provider chưa hỗ trợ giữ nội dung/link fallback của API. Không sao chép mã plugin XenForo. Reddit và Imgur tự điều chỉnh chiều cao từ message của provider — Reddit dùng `resize.embed` (origin `embed.reddit.com`/`www.redditmedia.com`), Imgur dùng `resize_imgur` (origin `https://imgur.com`); cả hai đều kiểm tra `event.source` đúng iframe và giới hạn 100–3000px. Ảnh Imgur đơn lẻ không bị đổi: `i.imgur.com` vẫn là `<img>` bình thường. X dùng khung cao cố định có cuộn; nội dung bị xóa, giới hạn vùng/đăng nhập hoặc chặn embed phụ thuộc provider.
- **Flickr qua oEmbed.** `[MEDIA=flickr]<short_id>[/MEDIA]` không có iframe để dựng: voz.vn để XenForo tự phân giải (`data-xf-init="oembed"`) và kết quả cuối cùng là **một ảnh**, không phải khung. Trang này làm tương tự: `restoreMedia()` thấy provider trong `OEMBED_SITES`, đánh dấu `media-embed--oembed` (giữ link fallback của API trong lúc chờ) rồi gọi `hydrateOembed()`. Hàm này `fetch('/api/xf/oembed?site=flickr&key=…')` — proxy vì Flickr **không gửi header CORS** — chờ placeholder xuất hiện trong DOM thật (`sanitizeHtml()` trả về chuỗi nên node lúc parse không phải node được chèn) rồi thay bằng `<a><img class="bbImage"></a>` + link "Xem trên Flickr". Ảnh chỉ được nhận khi host nằm trong `OEMBED_IMAGE_HOSTS` (`live.staticflickr.com` và các `farm*.staticflickr.com`), phải HTTPS và không có credentials; sai host thì bỏ ảnh và quay về fallback có viền. Giới hạn hiển thị `max-width: min(100%, 683px)`, giữ đúng tỉ lệ, canh trái như ảnh thường.
- Trang chủ đề tải danh mục `/voz/smilies` qua `lib/smilies.js`, đổi mã smiley trong văn bản thành ảnh đúng kích thước/2x. Không thay mã trong liên kết hoặc khối code. Trình soạn cũng hiển thị smiley ngay khi chọn hoặc gõ mã, không cần bấm Xem trước; ảnh nằm trong `contenteditable` nên `data-smilie` giữ mã gốc để serialize về BBCode, caret được đặt lại theo độ dài mã khi ảnh thay thế text.
- `ui/memberTooltip.js` hiện thẻ thông tin khi hover/focus tên hoặc avatar tác giả trên desktop; trên mobile ≤620px hoặc thiết bị không hỗ trợ hover, chạm tên/avatar để mở, chạm lại hoặc bên ngoài để đóng, dùng liên kết Hồ sơ trong thẻ để vào trang thành viên: avatar, chức danh, ngày tham gia, hoạt động, thống kê và liên kết hồ sơ/tin nhắn. Chi tiết được tải khi mở và cache theo thành viên; Escape, cuộn hoặc rời thẻ sẽ đóng.
- Tiêu đề trang chủ đề dùng nền trong suốt; các tiêu đề nhóm diễn đàn vẫn giữ màu xanh. Mobile ≤620px ẩn số trả lời/lượt xem, icon theo dõi và liên kết tác giả cạnh phân trang để tiết kiệm không gian; thông tin tác giả từng bài viết vẫn hiển thị. `ui/titleHold.js` bật/tắt theo dõi khi giữ tiêu đề 1,5 giây (hoặc Enter/Space khi focus); thả sớm, di chuyển quá 10px hoặc pointercancel sẽ hủy. Desktop giữ nút theo dõi và thống kê; yêu cầu theo dõi đang chạy được khóa để tránh gửi trùng.
- Thả/bỏ/đổi cảm xúc chỉ cập nhật nút và số đếm tại bài viết, không tải lại thread; giữ vị trí đọc và bản nháp trả lời. Các nút của cùng bài bị khoá khi đang gửi; lỗi giữ trạng thái cũ.
- Mỗi bài viết có icon đánh dấu cạnh số bài, dùng `POST /voz/posts/{id}/bookmark` với `state=bookmark|unbookmark`. Icon tô đầy khi đã lưu, khoá trong lúc gửi, giữ trạng thái cũ nếu lỗi. Khách được chuyển đến đăng nhập; danh sách đã lưu nằm trong menu tài khoản → Đánh dấu.
- `lib/userBadges.js` hiển thị mọi badge trong `User.banners` ở bài viết và thẻ thành viên, kiểm tra giá trị màu trước khi đưa vào CSS. Mobile (≤620px) dùng avatar 48px bên trái, tên phía trên, chức danh và badge cùng hàng có xuống dòng khi thiếu chỗ; desktop giữ avatar 96px và bố cục dọc.

---

## 1. Kiến trúc

```mermaid
flowchart LR
    B["Browser<br/>(public/index.html + assets/app.js)"]
    E["Vercel Edge Function<br/>api/[...path].js<br/>region sin1"]
    V["voz.vn/api<br/>(XenForo REST)"]
    A["voz.vn/oauth2/authorize"]

    B -- "/api/xf/*" --> E
    B -- "/api/oauth/*" --> E
    E -- "XF-Api-Key (guest)<br/>hoặc Bearer token" --> V
    B -. "popup + userscript" .-> A
    A -. "code" .-> B
```

Vì sao phải có lớp edge:

| Vấn đề | Lý do |
|---|---|
| `User-Agent: VOZ/MA26` | Thiếu UA này **mọi** request trả `403`. Trình duyệt không set được UA tuỳ ý. |
| `XF-Api-Key` | Nếu để trong JS thì ai cũng đọc được; giữ ở server. |
| Bearer token | Không nhét token vào `localStorage`; lưu trong cookie `HttpOnly`. |
| CORS | `voz.vn/api` không trả `Access-Control-Allow-Origin`, nên gọi trực tiếp từ browser bị chặn. |
| Region | `sin1` để Cloudflare thấy IP Singapore thay vì IP Việt Nam. |

---

## 2. Deploy

### 2.1 Chuẩn bị

```powershell
cd "D:\Data 2\Github-Clone\siritami\vtest"
npm i -g vercel      # hoặc dùng npx vercel
vercel login
```

### 2.2 Deploy

```powershell
vercel            # preview
vercel --prod     # production
```

Không cần biến môi trường nào — mọi hằng số (client id, guest key, scope) nằm trong
`api/[...path].js`.

### 2.3 Ép region Singapore

Đã khai báo ở hai chỗ, cả hai đều cần:

```js
// api/[...path].js
export const config = {
  runtime: 'edge',
  regions: ['sin1'],
};
```

```json
// vercel.json
{
  "version": 2,
  "regions": ["sin1"]
}
```

Kiểm tra sau khi deploy:

```powershell
curl.exe -s https://<project>.vercel.app/api/config
# {"siteUrl":"https://voz.vn", ...}
```

Header `x-vercel-id` trong response cho biết region thực tế, ví dụ
`hkg1::sin1::xxxx` — phần thứ hai là region chạy function.

### 2.4 Chạy local

```powershell
cd "D:\Data 2\Github-Clone\siritami\vtest"
node dev-server.mjs 3111
# → http://localhost:3111
```

`dev-server.mjs` chỉ để phát triển: nó serve `public/` và chuyển `/api/*` vào đúng
handler edge. Vercel không dùng file này.

### 2.5 `outputDirectory`

`vercel.json` khai báo `"outputDirectory": "public"`. Cần thiết vì gốc project còn chứa
`voz-app-api.md`, `voz-forum-deploy.md`, `LICENSE` — nếu không khai báo, Vercel sẽ coi
`public/` là thư mục con thường và các file `.md` có thể bị serve công khai.

---

## 3. Đăng nhập OAuth2 + PKCE

### 3.1 Vấn đề: redirect URI bị khoá

Ứng dụng OAuth `VOZ chính chủ` (`client_id=2424906941304717`) chỉ đăng ký **một**
redirect URI duy nhất:

```
vozma26://oauth
```

Đã thử và bị từ chối (`400 The provided redirect URI is not valid or does not match a
registered redirect URI`):

```
vozma26://oauth/            vozma26://oauth/callback     vozma26://oauth?x=1
exp+voz-ma-26://oauth       exp://127.0.0.1:8081/--/oauth
https://voz.vn/oauth2/callback                          https://voz.vn/oauth/callback
http://localhost:3000/api/oauth/callback
https://<project>.vercel.app/api/oauth/callback
```

Hệ quả: sau khi bấm **Authorize**, trình duyệt nhận `303` tới `vozma26://oauth?code=…`.
Không có app nào đăng ký scheme đó trên máy người dùng, nên **mã uỷ quyền bị mất** —
trang web không đọc được URL đích.

### 3.2 Cách giải quyết: userscript bắt mã

Userscript chạy trong chính trang voz.vn nên đọc được phản hồi. Mấu chốt: XenForo trả
**JSON** thay vì `303` nếu request có `_xfResponseType=json`.

```js
// thêm vào action của form Authorize
form.setAttribute('action', action + '&_xfResponseType=json');
```

Khi đó response là:

```json
{
  "status": "ok",
  "message": "Your changes have been saved.",
  "redirect": "vozma26://oauth?code=<CODE>&state=<STATE>",
  "visitor": { "conversations_unread": "0", "alerts_unviewed": "0", "total_unread": "0" }
}
```

Userscript đọc `redirect`, tách `code`, rồi:

1. hiện panel góc phải với nút **Copy code**,
2. lưu vào `sessionStorage` để hiện lại khi cần.

Mã **không** được gửi sang web client — người dùng tự copy rồi dán vào ô "Mã uỷ quyền".

Nó cũng hook `fetch` / `XMLHttpRequest` / `location.assign` để bắt trường hợp trang tự
redirect bằng JS.

### 3.3 Luồng đầy đủ

```mermaid
sequenceDiagram
    participant U as Người dùng
    participant W as Web client
    participant P as Popup voz.vn
    participant S as Userscript
    participant E as Edge function
    participant V as voz.vn/api

    U->>W: bấm "Đăng nhập"
    W->>W: sinh PKCE (verifier, challenge, state)<br/>lưu sessionStorage
    U->>W: bấm "Lấy mã uỷ quyền"
    W->>P: window.open(/oauth2/authorize?code_challenge=…)
    U->>P: bấm Authorize
    P->>S: form action + _xfResponseType=json
    S->>S: đọc JSON, tách code
    S-->>U: panel + nút "Copy code"
    U->>W: dán code vào ô "Mã uỷ quyền"
    W->>E: POST /api/oauth/exchange {code, verifier}
    E->>V: POST /api/oauth2/token (grant_type=authorization_code)
    V-->>E: access_token, refresh_token, expires_in
    E->>V: GET /api/me/ (Bearer)
    V-->>E: me
    E-->>W: Set-Cookie voz_session=…<br/>{ok:true, me}
    W->>U: "Xin chào <username>"
```

### 3.4 Vì sao đổi token phải ở server

`POST /api/oauth2/token` trả `403` (trang HTML Cloudflare) nếu thiếu
`User-Agent: VOZ/MA26`. Trình duyệt không set được header đó, nên bước đổi code lấy
token **bắt buộc** chạy ở edge function.

### 3.5 Endpoint OAuth của web client

| Method | Path | Body | Kết quả |
|---|---|---|---|
| GET | `/api/config` | – | `clientId`, `redirectUri`, `scopes`, `authorizeUrl` |
| GET | `/api/oauth/status` | – | `{ loggedIn, me }`; tự refresh nếu còn < 60 s |
| POST | `/api/oauth/exchange` | `{ code, verifier }` | set cookie, trả `{ ok, me }` |
| POST | `/api/oauth/logout` | – | revoke refresh token + xoá cookie |

Cookie:

```
voz_session=<base64url(JSON tokens)>; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000
```

Nội dung: `{ accessToken, refreshToken, expiresAt, scope, tokenType, obtainedAt }`.

`expiresAt` là **epoch ms** (`Date.now() + expires_in * 1000`), không phải giây. Cookie
không ký: `b64uEncode(JSON.stringify(tokens))` rồi `b64uDecode` khi đọc, lỗi parse thì coi
như chưa đăng nhập. `sessionCookie(null, 0)` tạo cookie rỗng `Max-Age=0` để đăng xuất.

### 3.6 Trang `/login`

Chỉ có một luồng: lấy mã uỷ quyền rồi đổi lấy token (PKCE). Đã gỡ tab dán access token
thủ công cùng endpoint `/api/oauth/token`.

### 3.7 Refresh token

Edge function tự refresh khi `expiresAt - now < 60_000`, và refresh một lần khi upstream
trả `401`. Token mới được ghi lại vào cookie qua `Set-Cookie` trên response đó.

```js
if (upstream.status === 401 && activeTokens) {
  refreshed = await refreshTokens(activeTokens);
  if (refreshed) {
    activeTokens = refreshed;
    upstream = await send(activeTokens);
  }
}
```

---

## 4. Proxy API

Mọi request của web client đi qua một tiền tố duy nhất:

```
GET /api/xf/<path>?<query>   →   https://voz.vn/api/<path>?<query>
```

Ví dụ:

| Web client | voz.vn |
|---|---|
| `/api/xf/nodes/` | `/api/nodes/` |
| `/api/xf/forums/13/threads?page=2` | `/api/forums/13/threads?page=2` |
| `/api/xf/threads/{id}/?with_posts=true&page=1` | `/api/threads/{id}/?with_posts=true&page=1` |
| `/api/xf/posts/` (POST) | `/api/posts/` (POST) |

Header do edge function gắn:

```js
headers.set('User-Agent', 'VOZ/MA26');
headers.set('Accept', 'application/json');
if (tokens) headers.set('Authorization', `Bearer ${tokens.accessToken}`);
else headers.set('XF-Api-Key', GUEST_KEY);
```

Body được chuyển nguyên `ArrayBuffer` nên `application/x-www-form-urlencoded` giữ đúng
encoding (kể cả tiếng Việt và `key[]=v`).

Response: giữ `status`, `content-type`, `xf-request-user`, `xf-request-user-extras`;
thêm `Cache-Control: private, no-store`.

Nếu upstream trả `401` và request có session, edge gọi `refreshTokens()` rồi gửi lại
**một lần**; token mới được ghi vào cookie bằng `Set-Cookie` trên chính response đó.
`redirect: 'manual'` nên `3xx` của voz.vn được trả nguyên trạng cho client.

### 4.1 Toàn bộ endpoint của edge function

`api/[...path].js` là một handler duy nhất, phân nhánh theo `url.pathname`:

| Method | Path | Xử lý |
|---|---|---|
| `OPTIONS` | bất kỳ | `204` + `corsHeaders()` |
| `GET` | `/api/config` | `{ siteUrl, clientId, redirectUri, scopes, authorizeUrl }` |
| `GET` | `/api/oauth/status` | đọc cookie, refresh nếu còn < 60 s, `fetchMe()`, trả `{ loggedIn, me }` |
| `POST` | `/api/oauth/exchange` | `{ code, verifier }` → `tokenRequest(grant_type=authorization_code)` → set cookie → `{ ok, me }` |
| `POST` | `/api/oauth/logout` | revoke refresh token (best-effort) + `Set-Cookie` rỗng `Max-Age=0` |
| `POST` | `/api/pik/upload` | chuyển tiếp multipart sang `https://pik.vn/api/upload`, trả nguyên `{ url, deleteUrl, exists }`; cần `Content-Type: multipart/form-data` |
| `GET` | `/api/xf/oembed?site=…&key=…` | phân giải oEmbed (hiện chỉ `flickr`) qua `OEMBED_TARGETS`, chỉ trả các trường an toàn (`url`, `title`, `width`, `height`, `web_page`); provider không gửi CORS nên phải đi qua proxy |
| `*` | `/api/xf` hoặc `/api/xf/…` | `handleProxy()` |
| `*` | còn lại | `404 { error: 'not_found', path }` |

`corsHeaders()` chỉ cho phép `https://voz.vn`, `*.vercel.app` và `http://localhost*`;
origin khác nhận `Access-Control-Allow-Origin: https://voz.vn`. Header gồm
`Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS`,
`Allow-Headers: Content-Type, Accept`, `Allow-Credentials: true`, `Max-Age: 86400`,
`Vary: Origin`.

`json()` luôn gắn `Content-Type: application/json; charset=utf-8` và
`Cache-Control: private, no-store, max-age=0`.

Hằng số trong file: `SITE`, `API_BASE`, `GUEST_KEY`, `CLIENT_ID`, `REDIRECT_URI`,
`UA = 'VOZ/MA26'`, `SCOPES` (11 scope, gồm `attachment:read` nhưng **không** có
`attachment:write`), `SESSION_COOKIE = 'voz_session'`, `SESSION_MAX_AGE = 30 ngày`.

### 4.2 Lớp client (`public/assets`)

Bốn tầng, import một chiều: `views` → `ui` → `lib` → `core`. `api.js` đứng riêng, được
`core/router.js`, `ui/*` và `views/*` cùng dùng. Ngoại lệ duy nhất là `core/router.js`
import mọi `views/*` để phân nhánh route — vì vậy `core/nav.js` giữ `setRouteHandler()`
để view gọi `navigate()` mà không phải import router (tránh vòng import).

**`core/` — hạ tầng, không phụ thuộc tầng trên**

| File | Export | Việc làm |
|---|---|---|
| `dom.js` | `app`, `breadcrumbsEl`, `accountEl`, `navEl`, `toastEl`, `modalRoot`, `state` | giữ handle DOM lấy một lần lúc load + state toàn cục `{ me, loggedIn, reactions, nodes, config }` |
| `utils.js` | `esc`, `num`, `unix`, `timeAgo`, `postDate`, `fullDate` | escape HTML; rút gọn số kiểu voz (`12K`, `444K`, `1M`); đổi giây → ms; thời gian tương đối |
| `paths.js` | `slugify`, `idFromSegment`, `threadPath`, `threadUnreadPath`, `forumPath`, `searchForumPath`, `userPath`, `dmPath`, `withPage` | dựng URL có slug giống voz.vn; `threadUnreadPath` = `threadPath` + `unread` |
| `nav.js` | `setRouteHandler`, `navigate`, `currentPage` | `pushState`/`replaceState` + gọi router; đọc `?page=` (hỗ trợ `last`) |
| `router.js` | `parsePath`, `route` | tách `/page-{n}` khỏi segment cuối, phân nhánh theo segment đầu, gọi view, bắt lỗi bằng `errorBox()`, cuối cùng `refreshUnreadCounts()` |
| `icons.js` | `ICON_*` | SVG inline, không icon font, không request thêm |

`postDate()` là biến thể riêng cho bài viết: tương đối đến hết ngày thứ 7, từ 8 ngày dùng
`fullDate()`. Các chỗ khác dùng `timeAgo()`.

**`lib/` — logic thuần, chỉ đụng DOM qua tham số `root`**

| File | Export | Việc làm |
|---|---|---|
| `avatar.js` | `avatarUrlById`, `avatarMarkup` | đoán `data.voz.vn/avatars/{size}/{floor(id/1000)}/{id}.jpg`; chồng `<img>` lên chữ cái màu, `onerror="this.remove()"` để lộ fallback |
| `bbcode.js` | `sanitizeHtml`, `bbcodeToPlain`, `stripQuotes`, `quoteBlock` | pipeline sanitize 7 bước (xem §6); `stripQuotes()` đếm độ sâu quote; `quoteBlock()` dựng `[QUOTE="…, post: …, member: …"]` |
| `postLinks.js` | `localPathFor`, `rewriteVozLinks`, `isVozUrl`, `VOZ_ORIGIN` | đổi link `https://voz.vn/…` trong nội dung bài thành đường dẫn nội bộ (xem §6) |
| `signature.js` | `signatureHtml` | chữ ký trả về dạng **BBCode thô** (xem §6.0b) nên phải render trước khi hiển thị; nhận `[URL=…]`, `[B]`, `[COLOR]`, `[SIZE]`, `[FONT]`, `[LIST]`, `[IMG]`…, tag lạ hiện nguyên văn |
| `editorCodec.js` | `safeEditorUrl`, `parseEditorCode`, `editorCodePlain`, `editorCodeHtml`, `editorDomCode` | BBCode ⇄ HTML cho trình soạn; tag lạ giữ nguyên dạng `data-bb-raw` (atomic, `contenteditable=false`); `[IMG size=…]` và `[ATTACH]` đã đăng ký được vẽ thành `<img>` thật, thuộc tính giữ qua `data-bb-attrs` |
| `attachments.js` | `registerAttachments`, `getAttachment`, `attachmentIdForUrl`, `clearAttachments`, `attachmentImage` | API trả `[ATTACH]id[/ATTACH]` trong `message` còn URL thật nằm ở `post.Attachments[].direct_url`; view đăng ký danh sách này để codec vẽ được ảnh. Không đăng ký thì giữ nguyên `data-bb-raw` (không mất dữ liệu) |
| `media.js` | `safeMediaUrl`, `restoreMedia` | allowlist host/path cho iframe; dựng lại `[MEDIA=…]`; nghe `resize.embed` của Reddit; phân giải Flickr qua `/api/xf/oembed` thành ảnh (`OEMBED_SITES`, `OEMBED_IMAGE_HOSTS`) |
| `imageFallback.js` | `wireImageFallbacks` | hiện thực `data-onerror` mà HTML voz.vn giả định có: bắt `error` pha **capture** trên `document` (sự kiện không bubble), `hide-parent` ẩn phần tử cha, `hide` ẩn ảnh. Gọi một lần ở `app.js`; không có `data-onerror` thì không đụng gì |
| `prefix.js` | `prefixLabel` | `prefix_id` → `label--{green,red,royalBlue,orange,primary,accent,gray,olive}` |
| `quotes.js` | `restoreQuoteLinks` | ghép `[quote=…, post: N]` với `blockquote.xfBb-quote` theo thứ tự + `data-name`, chèn link `↑` về `/p/N/` |
| `smilies.js` | `smilieChoices`, `loadSmilies`, `smiliesReady`, `splitSmilieText`, `renderSmilies` | tải `/voz/smilies` một lần, dựng regex từ mã đã escape, chỉ thay trong text node không nằm trong `a/code/pre/script/style`, chỉ nhận ảnh `https://data.voz.vn/`; trả `true` khi có thay đổi để editor biết khi nào cần đặt lại caret |
| `settings.js` | `loadSettings`, `saveSettings`, `addShortcut`, `updateShortcut`, `removeShortcut`, `moveShortcut`, `exportSettingsJson`, `importSettingsJson`, `normalizeShortcut`, `normalizeUrl`, `getInfiniteScroll`, `setInfiniteScroll`, `SCROLL_MODES`, `SCROLL_LABELS`, `getTheme`, `setTheme`, `THEME_MODES`, `THEME_LABELS`, `getFont`, `setFont`, `FONTS`, `FONT_LABELS`, `FONT_STACKS`, `getFontScale`, `setFontScale`, `normalizeFontScale`, `FONT_SCALE_MIN/MAX/STEP/DEFAULT`, `DEFAULT_SHORTCUTS` | thiết lập lưu ở `localStorage['voz-settings:v1']`; chưa có key thì trả về `DEFAULT_SHORTCUTS` (F33, F17) chỉ để hiển thị, lần ghi đầu tiên mới lưu; `infiniteScroll` (`on`/`manual`/`off`, mặc định `manual`), `theme` (`auto`/`light`/`dark`, mặc định `auto`), `font` (`system`/`roboto`/`be-vietnam-pro`/`be-vietnam`, mặc định `system`) và cỡ chữ (`postSize`/`uiSize`, % 80–200 bước 5, mặc định `100`) đi kèm trong cùng JSON backup; chỉ nhận URL http(s) tuyệt đối hoặc đường dẫn bắt đầu bằng `/`, chặn `javascript:`/credentials; `normalizeFontScale()` chỉ nhận number hoặc chuỗi số (vì `Number(null)`/`Number('')`/`Number([])` đều là `0` và sẽ kẹp về sàn 80%); phát event `voz:settings` mỗi lần ghi. `exportSettingsJson({albums, recent})` gộp cả dữ liệu sticker vào cùng file JSON (không còn khoá `clientId` — imgur Client-ID là hằng số) |
| `stickers.js` | `getAlbums`, `addAlbum`, `updateAlbum`, `renameAlbum`, `removeAlbums`, `moveAlbum`, `setAlbumImages`, `getRecentStickers`, `addRecentSticker`, `removeRecentSticker`, `clearRecentStickers`, `getClientId`, `imageFileToBase64`, `downscaleDataUrl`, `urlToBase64`, `downloadImagesInParallel`, `DEFAULT_CLIENT_ID` | album sticker trong `localStorage['voz-stickers:v1']`, gần đây ở `voz-stickers:recent:v1` (tối đa 30); `getClientId()` luôn trả `DEFAULT_CLIENT_ID` (không còn override lưu localStorage); ảnh thu nhỏ ≤ 400px, mã hoá WebP 0.8 (GIF giữ nguyên); chỉ nhận `https:` hoặc `data:image/…;base64,` |
| `views/settings.js` | `viewSettings` (+ `applyImported` nội bộ) | `applyImported(result)` dùng chung cho ô "Nhập album từ JSON" và mục Sao lưu: file `addOnly` chỉ thêm album mới (bỏ qua trùng tên), file đầy đủ thay thế album + gần đây; khoá `clientId` trong file cũ bị bỏ qua |
| `imgurImport.js` | `extractAlbumId`, `fetchImgurAlbumImages`, `importImgurAlbum`, `clearImgurCache` | tách album id từ `imgur.com/a/<slug>-<id>`, gọi qua proxy `/api/xf/imgur/album/{id}/images`, tải base64 song song 5 ảnh/lô |
| `spoilers.js` | `parseBbcode`, `restoreSpoilers` | parser stack; chỉ thay khi **số placeholder khớp số spoiler ngoài cùng** |
| `userBadges.js` | `userBadges` | `User.banners` → `.user-badge`, validate `#rgb`/`#rrggbb` trước khi đưa vào CSS |

**`ui/` — render HTML + wire sự kiện**

| File | Export | Việc làm |
|---|---|---|
| `chrome.js` | `renderAccount`, `renderNavShortcuts`, `wireNavShortcuts`, `setBreadcrumbs`, `setActiveNav` | header account (menu hồ sơ/đánh dấu/theo dõi/**cài đặt**/đăng xuất + 3 menu tiện ích), vẽ lại phím tắt ở thanh nav khi `voz:settings` hoặc `storage` đổi, breadcrumb có nút CTA, tô nav active |
| `headerMenus.js` | `closeHeaderMenus`, `wireHeaderMenus` | mở/đóng dropdown, tải 6 mục đầu, đánh dấu đã xem, Escape/click ngoài, submit form tìm kiếm nhanh |
| `forumNodes.js` | `nodeTree`, `nodeRow`, `nodeLink`, `childNodes`, `subForumBlock` | dựng cây node từ `nodes` + `tree_map`, `SearchForum` trỏ `/s/…` nội bộ; `subForumBlock` dựng khối diễn đàn con không tiêu đề cho trang `/f/…` |
| `feedback.js` | `toast`, `loading`, `errorBox` | toast 3,2 s; spinner; hộp lỗi đọc `ApiError.message` + `code` |
| `pagination.js` | `pagination`, `wirePageJump`, `wireScrollArm` | `ul.pageNav-main` XenForo; `…` đổi thành `<input type=number>` (Enter đi, Esc/blur huỷ); ở chế độ `manual` thêm nút icon `⇣` (`.pageNav-scrollBtn`, chỉ icon, `title`/`aria-label` giải thích). Nút `⇣` chỉ bật cuộn; nút dừng nổi `.infinite-stop` do `infiniteScroll.js` lo |
| `threadRow.js` | `threadRow`, `postRow` | 5 ô `structItem`; `postRow` cho bookmark/search, link dạng `?post={id}`. `is_unread` của API thêm class `is-unread` để CSS in đậm tiêu đề (đọc rồi thì hết đậm), giống voz.vn; tiêu đề của chủ đề chưa đọc trỏ `/unread` để nhảy tới bài chưa đọc |
| `unread.js` | `resolveUnread`, `threadLastPage`, `MAX_PAGE_WALKS`, `POSTS_PER_PAGE` | phân giải bài chưa đọc đầu tiên từ `visitor_read_date` bằng cách đi ngược từ trang cuối; dùng bởi `router.js` cho route `/unread` và bởi `threadRow.js` để tính số trang |
| `post.js` | `postHtml` | 1 `.message`: cột user (avatar 96px, tên, chức danh, badge, 3 thống kê), attribution (thời gian, `#position+1`, bookmark), body, signature, actionBar, dải cảm xúc |
| `reactions.js` | `reactionBar`, `invalidateReactionUsers`, `reactionSummary`, `hydrateReactionLists` | nút Ưng/Gạch + số lượng; dải tên best-effort từ `/p/{id}/reactions` |
| `editor.js` | `editorHtml`, `clearEditorDraft`, `wireEditor` | textarea là nguồn sự thật; visual `contenteditable`; undo/redo 100 bước; nháp localStorage 30 ngày; override `.value` để handler quote gán trực tiếp vẫn cập nhật visual |
| `stickerPicker.js` | `renderStickerPicker`, `STICKER_BBCODE` | popup chọn sticker dùng chung panel với emoji: tab album + "Gần đây", chèn `[IMG size="80x80"]<url>[/IMG]`, panel không đóng sau khi chọn |
| `pikUpload.js` | `isPikImage`, `supportsWebp`, `sha256Hex`, `preparePikImage`, `uploadPikBlob`, `uploadImageFile`, `uploadImageFiles`, `pikBbcode`, `PIK_MAX_SIZE`, `PIK_QUALITY`, `PIK_ORIGINAL_MAX`, `PIK_PARALLEL`, `PIK_PROXY` | tải ảnh lên pik.vn qua proxy `/api/pik/upload`: nén còn ≤1920px WebP 0.85, `hash` = SHA-256 của bytes gửi lên, 3 ảnh song song, chèn `[IMG]<url>[/IMG]`; dùng cho dải upload trong panel *Ảnh từ URL*, Ctrl+V và kéo thả |
| `infiniteScroll.js` | `mountInfiniteScroll`, `teardownInfiniteScroll`, `armInfiniteScroll`, `disarmInfiniteScroll`, `infiniteScrollActive`, `infiniteScrollMode` | cuộn liên tục cho danh sách chủ đề và chủ đề: `mountInfiniteScroll({ makeHref, currentPage, lastPage, after, fetchPage, insert })`, nối trang bằng `insertAdjacentHTML` rồi `replaceState` sang `page-N`. Chỉ tồn tại **một** `.infinite-stop` (nút tròn nổi `✕` góc phải dưới, `right: 16px`, `bottom: 64px`, mobile 38px/`72px`) mỗi khi đang bật; bấm nút gọi `disarmInfiniteScroll()` — dừng nạp nhưng **giữ nguyên** các trang đã nối và trả nút `⇣` trên thanh số trang về trạng thái chờ. `teardownInfiniteScroll()` gỡ luôn nút nổi |
| `editorTools.js` | `editorIcon`, `editorToolbar`, `showToolPanel`, `panelTools` | thanh công cụ 1 hàng + 3 menu nổi; panel chèn URL/ảnh/media/bảng/smilie/sticker |
| `memberTooltip.js` | `wireMemberTooltips` | thẻ thành viên hover (desktop) / chạm (≤620px hoặc `hover: none`), cache theo `user_id`, tự ẩn khi cuộn/Escape/rời DOM |
| `titleHold.js` | `wireTitleHold` | giữ tiêu đề 1,5 s (hoặc Enter/Space) để bật/tắt theo dõi; huỷ khi thả sớm, di chuyển > 10px, `pointercancel` |
| `unreadCounts.js` | `refreshUnreadCounts`, `wireUnreadCounts` | badge đỏ từ `pagination.total` của `?unread=true` / `?unviewed=true`; `99+`; refresh khi focus, đổi tab, mỗi 60 s; `force=true` chờ request đang chạy rồi mới tải lại |
| `inlineEdit.js` | `openInlineEdit`, `cancelInlineEdit` | sửa bài tại chỗ: thay `.message-main` bằng `.inline-edit` trong cùng `.message-cell--main.is-editing`, lưu xong vẽ lại thân bài + dòng attribution, huỷ thì trả DOM cũ | 
| `modal.js` | `openModal`, `openReportModal` | modal shell; báo cáo gọi `/api/xf/posts/{id}/report` |
| `session.js` | `loadSession`, `requireLogin` | boot session qua `/api/oauth/status`; chặn view khi chưa đăng nhập |

**`views/` — một file cho mỗi nhóm route**

| File | Export | Route |
|---|---|---|
| `forum.js` | `viewHome`, `viewForum`, `viewSearchForum`, `viewNewThreads` | `/`, `/f/…`, `/s/…`, `/new`; `viewForum` gọi `/nodes/` song song để lấy khối diễn đàn con |
| `thread.js` | `viewThread` | `/t/…` — render bài + toàn bộ handler (bookmark, react, quote, reply, edit, delete, report, watch, gửi trả lời) |
| `compose.js` | `viewCompose` | `/f/…/post-thread` |
| `search.js` | `viewSearch` | `/search` |
| `dm.js` | `viewDmList`, `viewDm`, `viewNewDm` | `/direct-messages…` |
| `lists.js` | `viewAlerts`, `viewBookmarks`, `viewWatched` | `/alerts`, `/bookmarks`, `/watched` |
| `user.js` | `viewUser` | `/u/…` |
| `login.js` | `viewLogin` | `/login` |

`api.js` xuất `ApiError`, `xf()`, object `api` và object `auth`. `api.createPost()` và
`api.stats()` có khai báo nhưng **không nơi nào gọi**: form trả lời trong `views/thread.js`
gọi `fetch('/api/xf/posts/')` trực tiếp.

### 4.3 Hành vi cần biết khi sửa code

| Chỗ | Chi tiết |
|---|---|
| `xf()` | `credentials: 'same-origin'`; body luôn `application/x-www-form-urlencoded`; mảng → `key[]=v`; boolean → `1`/`0`; giá trị rỗng/`null`/`undefined` bị bỏ |
| `ApiError` | `message` lấy từ `payload.errors[0].message`, fallback `payload.error`, fallback `HTTP {status}`; giữ `status`, `code`, `params`, `payload` |
| `parsePath()` | tách `/page-{n}` khỏi segment **cuối**; sau đó `?page=` ghi đè nếu có |
| `/p/{id}/` | `api.post(id)` → `api.thread(thread_id, 1)` → `floor(position / per_page) + 1` → `navigate(..., { replace: true })` + `#post-{id}`. Không giả định 20 bài/trang |
| `/t/…?post={id}` | `viewThread(id, page, focusPost)` cuộn tới `#post-{id}` sau khi render |
| `/t/…/unread` | `unreadTarget(id)` → `GET /threads/{id}/` lấy `visitor_read_date` → `resolveUnread()` đi ngược từ trang cuối → `navigate(page-N/#post-{id}, { replace: true })`. Chủ đề đã đọc / chưa từng mở ⇒ trang 1, không fragment |
| Gửi trả lời | `navigate()` sang trang rồi **gọi lại** `viewThread(threadId, 'last', post_id)` — render hai lần, lần hai mới đúng trang cuối |
| `page === 'last'` | `viewThread` tải trang 1, đọc `pagination.last_page`, rồi đệ quy gọi lại với số trang thật (API không có shortcut `last`) |
| `wireThreadActions()` | handler click gắn lên `#app` và lưu ở `app._threadHandler`; lần render sau `removeEventListener` handler cũ trước khi gắn mới, nên không bị nhân đôi |
| `wireEditor()` | đánh dấu `editor.dataset.wired`; gọi lại trên cùng container là no-op |
| `wireMemberTooltips()` | gọi `hide()` đầu tiên nên mỗi lần render chỉ có một thẻ mở |
| `refreshUnreadCounts(force)` | `force === true` chờ promise đang chạy rồi mới tạo request mới; `force` khác `true` thì trả luôn promise đang chạy |
| `state.nodes` | cache trong bộ nhớ; `viewHome()` chỉ gọi `/nodes/` lần đầu |
| `state.reactions` | cache trong bộ nhớ; `viewThread()` chỉ gọi `/voz/reactions` lần đầu, lỗi thì gán `[]` |
| Nháp editor | key `voz-editor:v1:{user_id|guest}:{pathname đã bỏ /page-N/}:{draftContext|textarea.id}`; TTL 30 ngày; `clearEditorDraft()` phát event `editor:clear-draft` |
| `reply-silent` | **Đã gỡ.** Không còn checkbox "Không đẩy chủ đề (silent)" trong form trả lời; `silent` không được gửi nữa. API vẫn hỗ trợ cờ này (`POST /posts/`) nếu muốn thêm lại |
| `dm` alias | router nhận cả `/dm/…` và `/direct-messages/…`; link trong UI luôn dùng `/direct-messages/` |
| `login.js` | không còn `message` listener; mã uỷ quyền do người dùng tự dán vào `#auth-code` |
| `PKCE` | verifier 48 byte ngẫu nhiên → base64url; challenge = SHA-256 → base64url; `state` 16 byte; lưu `sessionStorage['voz_pkce']` để reload không mất |
| `auth.exchange()` | trả `{ ok, data }` chứ không throw; view tự kiểm tra `ok` |
| `openReportModal()` | gọi thẳng `/api/xf/posts/{id}/report` bằng `fetch` + `URLSearchParams`, không qua `xf()` |

---

## 5. Chức năng

### 5.1 Bảng route

| Route | View | API dùng |
|---|---|---|
| `/` | Danh sách node/forum (cây 61 node) | `GET /nodes/` |
| `/f/{slug}.{node_id}/` | Danh sách chủ đề trong forum | `GET /forums/{id}/`, `GET /forums/{id}/threads` |
| `/f/{slug}.{node_id}/page-{n}/` | Trang n của forum | `GET /forums/{id}/threads?page=n` |
| `/s/{slug}.{node_id}/` | Node tổng hợp (SearchForum): Tin tức iNet, Review sản phẩm, Chia sẻ kiến thức | `GET /search-forums/{id}/`, `GET /search-forums/{id}/threads` |
| `/s/{slug}.{node_id}/page-{n}/` | Trang n của node tổng hợp | `GET /search-forums/{id}/threads?page=n` |
| `/t/{slug}.{thread_id}/` | Bài viết trong chủ đề | `GET /threads/{id}/?with_posts=true` |
| `/t/{slug}.{thread_id}/page-{n}/` | Trang n của chủ đề | `GET /threads/{id}/?page=n` |
| `/t/{slug}.{thread_id}/page-{n}/#post-{post_id}` | Nhảy tới bài cụ thể | `scrollIntoView` |
| `/t/{slug}.{thread_id}/?post={post_id}` | Mở đúng trang chứa bài rồi cuộn tới | `GET /threads/{id}/?page=n` |
| `/t/{slug}.{thread_id}/unread` | Nhảy tới bài chưa đọc đầu tiên → `replaceState` sang `page-N/#post-{id}` | `GET /threads/{id}/` (đọc `visitor_read_date`) → `GET /threads/{id}/posts?page=n` đi ngược từ trang cuối |
| `/p/{post_id}/` | Permalink bài viết → redirect sang thread | `GET /posts/{id}/` → `GET /threads/{id}/` |
| `/f/{slug}.{node_id}/post-thread` | Tạo chủ đề mới | `GET /forums/{id}/`, `POST /threads/` |
| `/new/` | Bài mới toàn diễn đàn (mở trực tiếp bằng URL, không còn mục nav) | `GET /threads/?order=post_date` |
| `/search?q=` | Tìm kiếm theo từ khoá | `POST /search/` → `GET /search/{id}/` |
| `/search?member=` | Tìm bài của một thành viên | `GET /users/find-name` → `POST /search/member` |
| `/direct-messages/` (alias `/dm/`) | Hộp thư | `GET /conversations/` |
| `/direct-messages/{slug}.{id}/` | Đọc + trả lời tin nhắn | `GET /conversations/{id}/?with_messages=true`, `POST /conversation-messages/` |
| `/direct-messages/new?to=` | Tạo tin nhắn mới | `GET /users/find-name`, `POST /conversations/` |
| `/alerts/` | Thông báo | `GET /alerts/` |
| `/bookmarks/` | Bài đánh dấu | `GET /voz/bookmarks` |
| `/watched/` | Chủ đề theo dõi | `GET /voz/watched-threads` |
| `/u/{slug}.{user_id}/` | Trang cá nhân | `GET /users/{id}/` |
| `/cai-dat-tuivoz` | Cài đặt (phím tắt nav + JSON backup) | không gọi API |
| `/login` | Đăng nhập | `/api/oauth/*` |

### 5.1.1 Routing — giống hệt voz.vn

URL **không dùng hash** và có slug, đúng như voz.vn:

```
https://voz.vn/t/<slug>.<thread_id>/page-<n>
https://voz.vn/f/<slug>.<node_id>/page-<n>
https://voz.vn/u/<slug>.<user_id>/
https://voz.vn/direct-messages/<slug>.<conversation_id>/
```

Quy tắc (đã kiểm tra bằng cách so 20 thread thật, khớp 20/20):

| Quy tắc | Chi tiết |
|---|---|
| Slug | lowercase, `đ→d`, bỏ dấu tiếng Việt (NFD + strip Mn), mọi ký tự không phải `[a-z0-9]` → `-`, trim `-` |
| Định dạng | `/{type}/{slug}.{id}/` — slug chỉ để đọc, **id số** mới là thứ API dùng |
| Trang | `/page-{n}/` trong path, **không** dùng `?page=`; trang 1 bỏ hẳn `/page-1` |
| Dấu `/` cuối | luôn có |
| Bài cụ thể | `#post-{post_id}` (fragment), không phải query |
| Legacy | `/t/{id}/` (không slug) vẫn parse được — `idFromSegment()` lấy phần sau dấu `.` cuối |

Hàm tương ứng trong `core/paths.js`:

```js
slugify(text)          // "Tiêu đề có dấu" → "tieu-de-co-dau"
idFromSegment(seg)     // "slug.123" → 123
threadPath(thread)     // → /t/slug.<thread_id>/
forumPath(forum)       // → /f/slug.<node_id>/
searchForumPath(node)  // → /s/slug.<node_id>/   (SearchForum)
userPath(user)         // → /u/slug.<user_id>/
dmPath(conversation)   // → /direct-messages/slug.<conversation_id>/
withPage(path, n)      // → path + "page-n/" (bỏ khi n = 1)
```

Điều hướng:

| Thành phần | Chi tiết |
|---|---|
| `navigate(path)` | `history.pushState` + `route()` + scroll top |
| `parsePath()` | đọc `location.pathname`, tách `/page-{n}` khỏi segment cuối |
| Click interception | listener ở `document`; bỏ qua `target=_blank`, `download`, khác origin, `/api/`, `/assets/`, `/userscript/` |
| Fragment cùng trang | `#post-…` chỉ scroll + `replaceState`, không render lại |
| Back/forward | `popstate` → `route()` |
| Legacy hash | `#/t/123` được `history.replaceState` sang `/t/123` lúc boot |

Vercel cần SPA fallback để deep link không 404:

```json
"rewrites": [
  { "source": "/((?!api/|assets/|userscript/).*)", "destination": "/index.html" }
]
```

`dev-server.mjs` có fallback tương tự (path không khớp file → `index.html`) **nhưng chỉ cho
route, không cho asset**: mọi path bắt đầu `/assets/` hoặc `/userscript/` mà không có file
thật sẽ trả **404**. Trước đây nó trả `index.html` kèm `200` cho tất cả, nên một file đã xoá
trông như vẫn phục vụ được (đúng ca đã gặp: 3 file phông cũ đã xoá trên đĩa mà vẫn `200`), và
một đường dẫn script gõ sai biến thành lỗi khó hiểu `Unexpected token '<'` thay vì 404.

### 5.2 Ghi dữ liệu

| Hành động | API | Scope |
|---|---|---|
| Trả lời chủ đề | `POST /posts/` `{thread_id, message}` (+ `silent=1` tuỳ chọn) | `thread:write` |
| Trích dẫn + trả lời | như trên, message có `[QUOTE=…]` | `thread:write` |
| Sửa bài | `POST /posts/{id}/` `{message}` | `thread:write` |
| Xoá bài | `DELETE /posts/{id}/` | `thread:write` |
| Thả cảm xúc | `POST /posts/{id}/react` `{reaction_id}` | `thread:write` |
| Báo cáo | `POST /voz/posts/{id}/report` `{message}` | login |
| Đánh dấu bài | `POST /voz/posts/{id}/bookmark` `{state}` | login |
| Theo dõi chủ đề | `POST /voz/threads/{id}/watch` `{state}` | login |
| Đánh dấu đã xem thông báo | `POST /alerts/mark-all` `{viewed:true}` | `alert:read` |
| Đánh dấu DM đã đọc | `POST /conversations/{id}/mark-read` `{date}` | `conversation:write` |
| Tạo chủ đề | `POST /threads/` `{node_id, title, message, prefix_id}` | `thread:write` |
| Gửi DM | `POST /conversations/` `{recipient_ids[], title, message}` | `conversation:write` |
| Trả lời DM | `POST /conversation-messages/` `{conversation_id, message}` | `conversation:write` |

### 5.3 Trích dẫn

Không có endpoint quote riêng. Web client dựng BBCode giống app:

```
[QUOTE="<author>, post: <post_id>, member: <user_id>"]
<nội dung, đã bỏ quote lồng>
[/QUOTE]

<nội dung bạn gõ>
```

`stripQuotes()` là bộ đếm độ sâu trên `/\[(\/?)quote(?:=[^\]]*)?\]/gi` — chỉ giữ text khi
depth = 0, nên quote lồng không bị nhân bản.

### 5.4 Cảm xúc

Là **toggle**, không có endpoint xoá riêng:

| Trạng thái | Gọi | Kết quả |
|---|---|---|
| chưa có | `reaction_id=1` | `action: "insert"`, score +1 |
| đang Ưng | `reaction_id=1` | `action: "delete"`, score 0 |
| đang Ưng | `reaction_id=2` | `action: "insert"`, score −1 (đổi, không cộng dồn) |

Danh mục lấy từ `GET /voz/reactions` (guest được). Chỉ `1 Ưng` và `2 Gạch` là `active`.

`reactionBar()` lọc danh mục `/voz/reactions` theo `r.active || counts[r.reaction_id]`, nên
thực tế chỉ hiện `Ưng` / `Gạch` (hai reaction `active`), cộng thêm bất kỳ reaction nào đã
có số đếm trên bài đó. Mỗi nút hiện icon + nhãn + **số lượng**, không hiện `reaction_score`
tổng. Nút đang chọn có class `.has-reaction` (màu cam); khi `post.can_react === false` thì
nút có `aria-disabled="true"` và handler bỏ qua click.

### 5.5 Xoá bài

`DELETE /posts/{id}/` là **xoá mềm**: bài biến mất khỏi danh sách, `reply_count` giảm 1,
`position` của các bài sau dồn lên, `post_id` **không đổi**. Gọi lần hai trả `404`
(không idempotent). Không có endpoint undelete qua REST.

> Tài khoản moderator xoá được bài của người khác mà không cần xác nhận. Web client chỉ
> hiện nút **Xoá** khi `can_soft_delete === true` và luôn hỏi `confirm()` trước khi gọi.

### 5.6 Phân quyền theo bài

Mỗi post trả về cờ quyền cho user hiện tại:

| Cờ | Dùng để |
|---|---|
| `can_edit` | hiện nút Sửa |
| `can_soft_delete` | hiện nút Xoá |
| `can_react` | bật/tắt nút cảm xúc |
| `can_view_attachments` | hiện ảnh đính kèm |

Thread có `can_reply` — `false` thì ẩn form trả lời.

---

## 6. Giao diện

Bảng màu lấy trực tiếp từ voz.vn bằng `getComputedStyle`:

| Thành phần | Giá trị |
|---|---|
| Header / nav | `#363d45` |
| Nav active | `#ff6600` |
| Block header | `#5c7099`, chữ `#ebecED` |
| Link | `#23497b`, hover `#ff6600` |
| Nền trang | `#373d43` |
| Nền block | `#f4f5f5` |
| Quote | nền `#eaeaeb`, viền trái `#ff944c` |
| Footer | `#102138` |
| Font | `"Be Vietnam", "Segoe UI", Roboto, sans-serif` |
| Bề rộng | `1058px` |

Cấu trúc giống XenForo: `.p-header` → `.p-nav` → `.p-body` → `.block` →
`.structItem` (danh sách) / `.message` (bài viết) → `.p-footer`.

### Logo header và footer

- Logo góc trái là **đúng tệp SVG của voz.vn**
  (`/styles/voz-xf-26/xenforo/voz-lockup-horizontal-reverse.svg`), chép về
  `public/assets/img/voz-lockup.svg` (1 KB) và nhúng bằng `<img>`. Dùng `<img>` thay vì
  inline `<path>` để chỉ có một tệp cache và giữ nguyên bản gốc không sửa.
- Artwork gốc màu trắng `#f2f4f7` nên hợp với header tối của cả hai chế độ; **không** áp
  filter hay đổi màu.
- Kích thước: `height: 26px; width: auto` → 51×26, đúng tỉ lệ `348 / 177.28`. voz.vn đặt
  `width: 98px` (cao ~50px) nhưng header bên này là dải mỏng nên scale theo chiều cao.
- Bấm logo vẫn về `/`; tên truy cập đọc được nhờ `aria-label="VOZ — về trang chủ"` trên thẻ
  `<a>` và `alt="VOZ"` trên `<img>`.
- Footer chỉ còn **một dòng**: “Voz của tui, xài voz theo cách của tui”. Hai câu cũ (dữ liệu
  lấy từ voz.vn / không liên kết chính thức) đã bỏ theo yêu cầu.
- `vtesst1/chrome-branding.test.mjs` khoá lại: SVG phải tồn tại và đúng `viewBox`, logo phải
  có tên truy cập + `href="/"`, footer đúng một `<p>` với đúng câu trên, và không sót câu cũ.

### Thanh trên cùng tự ẩn khi cuộn xuống

`ui/chromeAutoHide.js` + `layout.css`. **Cả hai** thanh — header (logo + ô tài khoản) và thanh
điều hướng — là `position: sticky` và cùng trượt lên khi cuộn xuống, hiện lại ngay khi cuộn
lên, đúng kiểu nút dừng cuộn liên tục.

- Ẩn bằng `transform: translateY(...)`, **không** dùng `display: none`: nội dung không bị
  reflow và vị trí cuộn không nhảy.
- Header dịch lên đúng chiều cao của nó (`--header-h`); nav bắt đầu ở `--header-h` nên phải
  dịch lên bằng tổng hai thanh (`--chrome-h`). Cả hai biến do module đo và ghi vào `:root`,
  cập nhật qua `ResizeObserver` nên đúng cả khi phím tắt render xong muộn hoặc phông đổi.
- **Đo bằng `getBoundingClientRect().height`, không phải `offsetHeight`.** `offsetHeight` làm
  tròn thành số nguyên, nên header cao thật `44.5px` bị báo `45` và nav đứng thấp hơn **0.5px**;
  khe hở đó lộ nền trang (`#373d43`) giữa hai thanh cùng màu `#363d45`. Nay giá trị lẻ được giữ
  nguyên (làm tròn 3 chữ số thập phân để tránh `44.399999px`), `--header-h: 44.5px`.
- **Không có `border-top` trên `.p-nav`.** Trước đây có `1px solid var(--overlay-hairline)`
  (`rgba(255,255,255,.06)`) — đúng nghĩa một **đường trắng mảnh** cắt đôi hai thanh. Hai thanh
  dùng chung `--nav-bg` nên không cần vạch phân cách; ranh giới đã do gạch chân tab đang chọn
  đảm nhiệm. Kiểm chứng bằng cách lấy mẫu pixel: trước khi sửa có 2 hàng lệch màu
  (`#373d43` = nền trang lọt qua khe, `#40474e` = đường hairline), sau khi sửa **0 hàng lệch**,
  cột pixel liền một màu `#363d45` ở cả desktop lẫn mobile, cả hai chế độ sáng/tối.
- Ngưỡng `REVEAL_THRESHOLD` 8px giống nút dừng cuộn, để trackpad/rubber-band không nhấp nháy.
  Không bao giờ ẩn khi đang ở sát đầu trang (`y <= 4`) — phía trên không còn gì để cuộn lên,
  và logo là đường về trang chủ.
- Menu thả xuống nằm trong header sẽ **tự đóng** khi thanh ẩn (`closeHeaderMenus()`), nếu không
  nó sẽ lơ lửng trên nội dung.
- `z-index` tách lớp: nav **100**, header **110**. Cả hai đều tạo stacking context, nên nếu
  bằng nhau thì nav (đứng sau trong DOM) sẽ vẽ đè lên menu thả xuống của header — menu mở
  xuống và cắt ngang dải của nav, càng nhiều phím tắt (nav cao nhiều dòng) càng lộ rõ. Nav 100
  vẫn trên nội dung và nút dừng cuộn (40); header 110 vẫn dưới thẻ thành viên (150), toast
  (900) và modal (1000).
- **`html { scroll-padding-top: var(--chrome-h) }`** là bắt buộc: không có nó, mọi nhảy tới
  `#post-<id>` và `scrollIntoView()` sẽ chui xuống dưới thanh sticky (đã kiểm chứng: bài viết
  nằm ở `top: 82px` sau khi thêm, thay vì `top: 0`).
- Cuộn do chương trình (permalink, sửa bài tại chỗ) không bị hiểu nhầm là người dùng cuộn
  xuống: `suppressBriefly()` bỏ qua delta trong 250 ms, `suppressChromeAutoHide()` cho view gọi
  trước `scrollIntoView()` của mình. Khi mở trang bằng deep link có `#`, module khởi động ở
  trạng thái chưa "armed" và chờ cử chỉ thật (`wheel`/`touchmove`) rồi mới theo dõi hướng.
- `prefers-reduced-motion` tắt transition.
- Mobile 390px: `--header-h` 45px, `--chrome-h` 81px, `scroll-padding-top` khớp, không tràn
  ngang.

### Kích thước hai thanh

Đây là dải mỏng để nhường chỗ cho nội dung; cả desktop lẫn mobile dùng cùng một bộ số, chỉ khác
nhau ở chỗ nào bị ẩn.

| Phần | Desktop | Mobile ≤620px |
|---|---|---|
| `.p-header-inner` | `padding: 6px 12px`, `gap: 14px` | `gap: 4px` |
| logo `img` | `height: 26px` → 51×26 | 51×26 |
| `.header-icon` | 32×32 (`padding: 5px`, icon SVG 17px) | 30×30 |
| `.p-header-account .avatar` | 24×24 | 24×24 |
| `.p-nav-list a` | `padding: 6px 12px`, `font-size: 14px` → cao 36px | giống desktop → 36px |
| **Header** | **46px** | **45px** |
| **Nav** | **36px** | **36px** |

- Bề rộng thật của header do `.header-icon` quyết định (`min-height: 32px`), không phải padding
  của `.p-header-inner` — giảm padding mà không giảm icon thì thanh không thấp đi. Vì vậy cả
  hai phải chỉnh cùng lúc.
- `font-size` icon SVG đặt thẳng ở `.header-icon svg` để nút bấm nhỏ lại nhưng glyph không bị
  tràn ra ngoài hộp.
- **Không có ô tìm kiếm trên header.** Bản trước có một ô nhập chữ + nút *Tìm* đặt giữa logo
  và ô tài khoản, nhưng nó chiếm gần hết chiều ngang (input 375px) để rồi trùng chức năng với
  menu Tìm kiếm. Nay chỉ còn **icon kính lúp** trong cụm tiện ích bên phải (cùng chỗ với
  Hộp thư / Thông báo), bấm vào mở menu tìm kiếm — đúng một lối vào cho tìm kiếm ở mọi kích
  thước màn hình. CSS `.p-header-search` đã xoá hẳn (trước đó nó là CSS chết: chưa từng có
  phần tử nào trong DOM cho tới lần thêm rồi gỡ này).
- `.p-nav-list` vẫn giới hạn `max-height: 40vh; overflow-y: auto`; các phím tắt do người dùng
  thêm vẫn hiện đủ, chỉ cao hơn theo hàng khi cần.

CSS chia theo khu vực, nạp đúng thứ tự trong `index.html`:

| File | Phạm vi |
|---|---|
| `base.css` | biến màu `:root`, reset, utility (`.u-dimmed`, `.u-srOnly`, …) |
| `layout.css` | `.p-header`, `.p-nav`, `.p-body`, `.block`, `.p-footer` |
| `forum.css` | `.node-*`, `.structItem*`, `.pairs`, `.pageNav` |
| `avatar.css` | `.avatar`, `.avatar-fallback`, `.label--*` |
| `post.css` | `.message*`, `.inline-edit*`, `.member-card`, `.block-outer`, `.reactionsBar`, BBCode |
| `media.css` | `.bbCodeBlock--unfurl`, `.media-embed`, `.media-frame` |
| `reaction.css` | `.reaction`, `.reaction-count` |
| `forms.css` | `.button`, `.input`, `.textarea`, `.tabs` |
| `editor.css` | `.rich-editor`, `.editor-toolbar`, `.editor-overflow`, `.editor-panel` |
| `account.css` | `.dm-*`, `.alert-*`, `.profile-*`, `.login-*`, `.code-box` |
| `misc.css` | `.loading`, `.empty`, `.error-box`, `.toast`, `.modal*` |
| `responsive.css` | override ≤900 / ≤860 / ≤650 / ≤620 px |
| `headerMenus.css` | `.header-menu*`, `.header-unread`, `.button--cta` |
| `home.css` | layout `.node-row` / `.node-extra` của trang chủ |

`editor.css` phải đứng sau `forms.css` vì nó ghi đè `.editor-toolbar`; `responsive.css`,
`headerMenus.css`, `home.css` phải đứng cuối để override thắng.

Nội dung bài viết render từ `message_parsed` (HTML server trả về), được lọc qua
`sanitizeHtml()`: bỏ `script/style/object/embed/form/input/button`, bỏ mọi thuộc
tính `on*`, chặn `javascript:` trong `href`/`src`, thêm `target="_blank" rel="noopener
nofollow ugc"` cho link. `iframe` **không** bị xoá ngay — `restoreMedia()` dựng lại toàn bộ
thuộc tính (xoá `srcdoc`, event handler, thêm `sandbox`) và chỉ giữ những host/path nằm
trong allowlist; iframe ngoài allowlist bị `remove()`.

Thứ tự xử lý trong `sanitizeHtml(html, bbcode)`:

1. `restoreSpoilers(root, bbcode)` — thay placeholder bằng `details/summary`.
2. Xoá thẻ nguy hiểm + thuộc tính `on*` + `javascript:`; mọi `<a>` nhận `target="_blank"`.
3. `rewriteVozLinks(root)` — đổi link `https://voz.vn/…` trỏ về route nội bộ (xem §6.0).
4. `restoreQuoteLinks(root, bbcode)` — thêm link `↑` về `/p/{post_id}/`.
5. `restoreMedia(root)` — dựng lại iframe/media.
6. `applyImageSizes(root, bbcode)` — gán lại `width`/`height` từ BBCode.
7. `renderSmilies(root)` — đổi mã smiley thành `<img>`.

Thứ tự bước 2 → 3 là bắt buộc: bước 2 gán `target="_blank"` cho **mọi** link, còn bước 3
gỡ `target` khỏi những link đã thành nội bộ, nên link nội bộ không mở tab mới. Đổi thứ tự
sẽ khiến mọi link trong bài mở tab mới.

`sanitizeHtml` cũng được gọi cho `user.signature`, `user.about` và `message_parsed` của DM
— các chỗ này truyền **không** có `bbcode`, nên spoiler/quote-link/kích thước ảnh không
được khôi phục (chỉ sanitize + postLinks + media + smiley).

### 6.0 Link trong bài — không đá người đọc sang voz.vn

Bài viết trên voz.vn đầy link tuyệt đối về chính voz.vn
(`https://voz.vn/t/<slug>.<id>/page-4#post-44143309`). Giữ nguyên thì mỗi cú bấm sẽ đưa
người đọc ra khỏi app. `lib/postLinks.js` đổi phần origin thành đường dẫn nội bộ, giữ
nguyên path/query/hash nên router xử lý y hệt voz.vn:

| Tiền tố | Đích nội bộ |
|---|---|
| `/t/…`, `/f/…`, `/s/…`, `/u/…`, `/p/…`, `/search`, `/new` | giữ nguyên path, bỏ `https://voz.vn` |

Link **không** đổi (vẫn trỏ voz.vn, mở tab mới) khi:

- khác origin (`tuoitre.vn`, `data.voz.vn`, `youtube.com` — chú ý `data.voz.vn` khác origin),
- path không có route nội bộ: `/login/`, `/attachments/…`, `/misc/…`,
- là route **chỉ có trên web** của XenForo: `/u/<slug>.<id>/ignore`, `/unignore`, `/report`,
  `/warn`, `/follow`, `/unfollow`. Ngoại lệ này là bắt buộc vì các route đó cần **cookie
  session** + `_xfToken`, thứ app không có — xem §13.5 của `voz-app-api.md`. Nút Bỏ qua
  trong bài vì vậy mở sang voz.vn ở tab mới; API không có endpoint ignore
  (`/api/users/{id}/ignore`, `/api/voz/users/{id}/ignore`, `/api/me/ignored` đều `404`, và
  gọi thẳng `https://voz.vn/u/…/ignore` trả `403` khi không có cookie).

### 6.0b Chữ ký là BBCode thô, không phải HTML

`post.message_parsed` là HTML do server render, nhưng `User.signature` trả về **BBCode
chưa parse**. Chuyển thẳng vào `sanitizeHtml()` thì thẻ hiện nguyên văn — người đọc thấy
`Nhắn cho mình ở [URL='https://t.me/zerotrustai']telegram[/URL]` trong khi voz.vn hiện link.
`[B]…[/B]`, `[COLOR=…]`, `[SIZE=…]` cũng bị hỏng y như vậy.

`lib/signature.js` render trước rồi mới giao cho `sanitizeHtml()`:

- `[URL=<url>]nhãn[/URL]` và `[URL]<url>[/URL]` → `<a>`, URL qua `safeEditorUrl()` (chỉ
  http/https, không credentials).
- `[B] [I] [U] [S]`, `[LIST][*]`, `[COLOR]` (hex + tên màu voz.vn), `[SIZE]` (thang 1–7 hoặc
  px 8–40), `[FONT]` (**chỉ** phông app có: Be Vietnam, Be Vietnam Pro, Roboto), `[IMG]`.
- `[QUOTE]`/`[SPOILER]`: giữ chữ, bỏ khung.
- Tag lạ: hiện **nguyên văn** (không đoán, không mất nội dung).
- HTML thô trong chữ ký bị escape.

Vì `sanitizeHtml()` chạy sau, chữ ký cũng được hưởng `rewriteVozLinks` (§6.0) và toàn bộ
escape/target/rel — nên một link `https://voz.vn/t/…` trong chữ ký cũng thành link nội bộ.

### 6.1 Ảnh trong bài — API làm mất kích thước

`message_parsed` **bỏ toàn bộ thuộc tính kích thước ảnh**. Ví dụ một post thật:

```
BBCode : [IMG size="80x80"]https://<image-host>/….webp[/IMG]
HTML   : <img src="https://<image-host>/….webp" alt="" />
```

Ảnh gốc 512×512 nên render full-size, trong khi voz.vn hiển thị đúng 80×80. Các biến thể
gặp trong thực tế (quét 3 trang của một thread):

| BBCode | Số lần | Kích thước bị mất |
|---|---|---|
| `[IMG]url[/IMG]` | 27 | không có (giữ nguyên) |
| `[ATTACH type="full" alt="…"]id[/ATTACH]` | 7 | không có |
| `[ATTACH=full]id[/ATTACH]` | 4 | không có |
| `[IMG width="172px"]url[/IMG]` | 4 | `width` |
| `[IMG alt="…"]url[/IMG]` | 3 | không có |
| `[ATTACH type="full" width="578px"]id[/ATTACH]` | 1 | `width` |
| `[ATTACH type="full" width="578px" alt="…"]id[/ATTACH]` | 1 | `width` |

Cách xử lý: `applyImageSizes()` đọc lại BBCode gốc, dựng map `src → {width, height}`, rồi
gán lại `width`/`height` lên `<img>` tương ứng trong HTML đã parse.

```js
// [IMG size="80x80"]url[/IMG]      → width 80, height 80
// [IMG width="150px"]url[/IMG]     → width 150
// [ATTACH type="full" width="150px"]<attach_id>[/ATTACH] → width 150
```

Khoá so khớp: URL ảnh thường bị chuẩn hoá khác nhau giữa BBCode và HTML
(`/attachments/<id>/` so với `/attachments/<hash>-webp.<id>/`), nên
`normalizeImgSrc()` quy cả hai về `attach:<id>`; ảnh ngoài thì bỏ scheme/host
`voz.vn`, query và dấu `/` cuối.

CSS đi kèm để không méo ảnh:

```css
.bbWrapper .bbImage { max-width: 100%; height: auto; }
.bbWrapper img:not(.smilie) { max-width: 100%; height: auto; }
```

Kết quả so với voz.vn (cùng một post):

| Ảnh | BBCode | voz.vn | Web client |
|---|---|---|---|
| ảnh ngoài 1 | `[IMG]` | 725×453 | 860×538 (khung rộng hơn) |
| ảnh ngoài 2 | `width="150px"` | 150×29 | 150×29 |
| attach A | `width="150px"` | 150×33 | 150×33 |
| attach B | `width="345px"` | 345×158 | 345×158 |
| attach C | không size | 725×1036 | 840×1200 (khung rộng hơn) |

### 6.2 Bố cục bài viết

| Vị trí | Nội dung |
|---|---|
| Góc trên phải | icon đánh dấu (`data-bookmark`) + `#<số bài>` (API trả `position` **0-based**, hiển thị `position + 1`) |
| Đáy trái | icon báo cáo (cờ) → `Sửa` / `Xoá` (chỉ khi `can_edit` / `can_soft_delete`) |
| Đáy phải | `Ưng` / `Gạch` → icon trích dẫn → icon trả lời |
| Dải xám dưới đáy | icon cảm xúc + tên thành viên đã thả |

`.message-content` là flex column và `.message-footer` có `margin: auto 0 0`, nên với bài
ngắn (nội dung 1 dòng trong khi cột thông tin user cao 234px) footer vẫn bám đáy thay vì
lơ lửng giữa bài.

Cảm xúc hiện icon + nhãn `Ưng` / `Gạch` kèm **số lượng** (`Ưng 2`), không hiện điểm tổng
(`+2`). Trạng thái đang chọn đánh dấu bằng `.has-reaction` (màu cam).

Thời gian bài viết: `<time data-post-time title="<ngày giờ đầy đủ>">`. Trên mobile ≤620px,
chạm vào thời gian sẽ `preventDefault()` và thay `textContent` bằng `title` tại chỗ —
không nhảy tới permalink; liên kết `#post-…` cạnh đó vẫn hoạt động.

Sửa bài mở **tại chỗ** giống voz.vn (`/p/{id}/edit`): `.inline-edit` thay `.message-main`
trong cùng `.message-cell--main.is-editing`, không có modal. Editor dùng chung với
`draftContext = edit-post-{post_id}` nên nháp từng bài không trộn vào nháp trả lời. `Esc`
hoặc nút Huỷ trả DOM cũ nguyên vẹn; lưu xong chỉ vẽ lại thân bài + dòng attribution
(không reload trang). Chỉ mở một editor tại một thời điểm — mở bài khác tự đóng bài trước.
Xoá bài luôn hỏi `confirm()` trước khi gọi `DELETE /posts/{id}/`.

### 6.3 Thanh trên cùng của chủ đề

Sao chép từ voz.vn:

| Thành phần | Chi tiết |
|---|---|
| `.block-header` | thanh xanh `#5c7099`, chứa tiêu đề + số trả lời/lượt xem |
| Nút theo dõi | **icon con mắt** trong thanh xanh, góc phải; bật = nền cam `#ff6600` |
| `.block-outer` | hàng riêng ngay dưới thanh xanh, chứa `.pageNav` |
| `.pageNav` | `‹ Trước` + `ul.pageNav-main` (các số trang) + `Sau ›` + tên tác giả bên phải |

Phân trang dùng `ul/li` giống XenForo: mỗi số là một `li.pageNav-page`, trang hiện tại là
`span.current` (nền `#5c7099`, chữ trắng), các trang khác nền `#dfe7f6`. Dấu `…` là
`li.pageNav-skip` — bấm vào sẽ đổi thành ô nhập số trang (Enter để đi, Esc/blur để huỷ).

Nút theo dõi gọi `POST /voz/threads/{id}/watch` với `state=watch` / `state=unwatch`; trạng
thái ban đầu đọc từ `thread.is_watching` (chỉ có khi đã đăng nhập).

### 6.4 Dải cảm xúc (tên thành viên)

API **không** trả danh sách người đã thả cảm xúc — chỉ có `reaction_counts`. Danh sách
nằm ở route web `/p/{post_id}/reactions` (HTML), và route này:

| Cách gọi | Kết quả |
|---|---|
| `curl` với UA trình duyệt | `200` |
| `fetch` từ browser (cross-origin) | `200` nhưng **CORS chặn đọc body** |
| `fetch` từ Node / Vercel Edge | `403` — Cloudflare challenge (TLS fingerprint) |

Vì vậy dải này là **best-effort**: `reactionSummary()` render
`<div class="reactionsBar" data-reaction-list="<post_id>">` với chữ "Đang tải thành viên…",
`hydrateReactionLists()` gọi `loadReactionUsers()` — `fetch` trực tiếp
`https://voz.vn/p/{id}/reactions` từ browser, parse `.block-row--separated`, cache theo
post trong `reactionUsersCache` (xoá bằng `invalidateReactionUsers()` sau khi đổi cảm xúc).
Khi fetch lỗi hoặc CORS chặn đọc body, dải tự xoá khỏi DOM (`strip.remove()`) nên không
hiện khung rỗng.

`api/[...path].js` có thêm `fetchReactionUsers()` / `parseReactionList()` / `reactionCache`
(TTL 60 s) chạy phía edge, nhưng **hiện không được route nào gọi** — giữ lại làm tham chiếu
cho hướng xử lý server-side nếu Cloudflare ngừng chặn.

Số lượng cảm xúc vẫn hiển thị đầy đủ trên nút `Ưng` / `Gạch` vì lấy từ `reaction_counts`
trong response API.

Ảnh trong bài (`voz.vn/attachments/…`) hotlink được — đã kiểm tra trả `200 image/webp`
kể cả khi `Referer` là domain khác.

### 6.5 Danh sách chủ đề (`structItem`)

Bảng chủ đề dùng đúng cấu trúc bảng của XenForo — `display: table` + `table-layout: fixed`,
5 ô:

| Ô | Rộng | Nội dung |
|---|---|---|
| `--icon` | 52px | avatar người lập chủ đề (36px) |
| `--main` | auto | `ul.structItem-statuses` (float phải) + tiêu đề + `structItem-minor` |
| `--meta` | 135px | 2 dòng `dl.pairs--justified`: `Trả lời` / `Lượt xem` |
| `--latest` | 190px | thời gian bài cuối + tên người gửi cuối, canh phải |
| `--iconEnd` | 40px | avatar người gửi cuối (24px) |

`dl.pairs--justified` đặt `dt` float trái và `dd` float phải, nên **mọi con số trong cột
thẳng hàng nhau** bất kể độ dài nhãn.

**Trạng thái** dùng mask SVG của Font Awesome 5 (nhúng dạng data-URI, không phụ thuộc
mạng): `structItem-status--sticky` = thumbtack, `structItem-status--locked` = ổ khoá.
Chủ đề ghim có tiêu đề màu cam (`--link-hover`), giống voz.vn.

**Tiền tố** (`prefix_id`) map sang class màu của XenForo — bảng lấy trực tiếp từ
`<option data-prefix-class>` trong form đăng bài của từng forum:

| id | nhãn | class |
|---|---|---|
| 4 | góp ý | `green` |
| 5 | báo lỗi | `red` |
| 6 | thắc mắc | `royalBlue` |
| 7 | chú ý | `orange` |
| 8 / 9 / 10 / 11 | HN / SG / ĐN / khác | `green` / `red` / `royalBlue` / `orange` |
| 12 | thảo luận | `primary` |
| 13 | tin tức | `accent` |
| 14 | đánh giá | `red` |
| 15 | khoe | `green` |
| 16 | thắc mắc | `orange` |
| 17 | kiến thức | `royalBlue` |
| 18 | TQ | `gray` |
| 19 | download | `olive` |
| 20 / 21 | tuyển dụng / tìm việc | `red` / `green` |
| 22 | Dịch | `royalBlue` |

**Avatar** dùng `avatarMarkup()`: một `<span>` nền màu + chữ cái đầu, ảnh thật phủ lên
trên. Nếu ảnh 404 (`onerror="this.remove()"`) thì lộ ra avatar chữ cái — đúng như
`avatar--default--dynamic` của XenForo. Bảng màu chữ cái lấy từ voz.vn
(`#66cc66/#206020`, `#669966/#1f2e1f`, …), chọn theo `user_id % 7`.

Với user chỉ có `user_id` + `username` (không có `avatar_urls`), ảnh được đoán theo quy
tắc thư mục của voz.vn: `https://data.voz.vn/avatars/{size}/{floor(id/1000)}/{id}.jpg`.
Nếu `avatar_urls` tồn tại nhưng toàn `null` thì user thật sự không có avatar → chỉ hiện
chữ cái, không đoán (tránh 404).

**Số liệu** làm tròn giống voz.vn: `12301 → 12K`, `443764 → 444K`, `1274095 → 1M`
(`Math.round`, không có phần thập phân).

---

## 7. Userscript

File: `public/userscript/voz-oauth-helper.user.js`

```
@name        VOZ OAuth helper
@namespace   https://voz-forum.vercel.app/
@version     1.0.0
@match       https://voz.vn/oauth2/*
@match       https://voz.vn/*
@grant       GM_setClipboard, GM_getValue, GM_setValue
@run-at      document-start
@noframes
```

Cài bằng Tampermonkey / Violentmonkey, hoặc mở trực tiếp
`https://<project>.vercel.app/userscript/voz-oauth-helper.user.js`.

Cơ chế:

| Bước | Việc làm |
|---|---|
| 1 | Patch `location.assign` / `location.replace` để chặn `vozma26://` |
| 2 | Hook `window.fetch` — đọc response của `/oauth2/authorize` |
| 3 | Hook `XMLHttpRequest` — XenForo submit form bằng XHR |
| 4 | Thêm `&_xfResponseType=json` vào `action` của form Authorize |
| 5 | Đọc `<body>` nếu nó là JSON (trường hợp form submit điều hướng thật) |
| 6 | Hiện panel với mã và nút **Copy code** |

Panel hiện `code`, nút **Copy code**, và nhắc rằng code chỉ dùng được một lần.

Chi tiết triển khai:

| Mục | Giá trị |
|---|---|
| Panel id | `voz-oauth-helper-panel` (tạo lại thì xoá bản cũ trước) |
| Storage key | `voz_oauth_last_code` — ghi cả `GM_setValue` và `sessionStorage` |
| Trích code | `/[?&]code=([A-Za-z0-9._~-]+)/` trên chuỗi bất kỳ (URL, JSON, body) |
| Trích state | `/[?&]state=([A-Za-z0-9._~-]+)/` |
| `postMessage` | **Đã gỡ** — userscript không gửi mã sang web client nữa |
| Copy | `GM_setClipboard` → `navigator.clipboard.writeText` → `textarea` + `execCommand('copy')` |
| Hiện lại | Vào lại `/oauth2/*` mà chưa có panel thì dựng panel từ code đã lưu |
| `@noframes` | Không chạy trong iframe, tránh panel nhân bản |

Mã **không** đi qua `postMessage`; người dùng copy từ panel rồi dán vào `#auth-code`
trên `/login`. Nếu tab web client đã đóng thì vẫn copy tay được từ panel.

---

## 7.1 Trang cài đặt (`/cai-dat-tuivoz`)

Vào từ menu tài khoản (avatar góc phải) → **Cài đặt**. Trang không gọi API nào; mọi thứ
lưu trong `localStorage['voz-settings:v1']` của trình duyệt.

### Tab

Trang chia thành **5 tab** thay vì một chuỗi dài phải cuộn: `Giao diện` (sáng/tối, phông,
cỡ chữ), `Cuộn trang liên tục`, `Phím tắt`, `Sticker`, `Sao lưu / phục hồi`.

- Tab đang chọn nằm ở **fragment**: `/cai-dat-tuivoz#stickers`. Nhờ vậy F5 mở lại đúng tab,
  và link **Quản lý sticker** trong popup sticker (`ui/stickerPicker.js` →
  `/cai-dat-tuivoz#stickers`) mở thẳng tab Sticker. Fragment lạ/rỗng → tab đầu tiên.
- `history.replaceState` khi đổi tab, **không** `pushState`: bấm 5 tab rồi Back vẫn về
  trang trước đó chứ không phải lùi từng tab.
- Cả 5 panel **luôn nằm trong DOM**, panel không chọn chỉ có `[hidden]`. Lý do: phần wiring
  bên dưới (`wireStickerSettings()`, form phím tắt, sao lưu) tra `document.getElementById`
  một lần lúc mount — gỡ panel khỏi DOM sẽ để lại handler trỏ vào node đã tách. Đổi tab chỉ
  bật/tắt `hidden`, nên trạng thái form, album đang sửa dở, JSON đã dán… đều giữ nguyên.
- `.settings-panel { display: block }` cần đi kèm `.settings-panel[hidden] { display: none }`
  — `display` trên class thắng thuộc tính `hidden` của trình duyệt, thiếu rule thứ hai là
  mọi panel cùng hiện.
- Bàn phím: `role="tablist"`/`role="tab"`/`aria-selected`, roving `tabindex` (chỉ tab đang
  chọn nhận focus). `←`/`→` chạy vòng, `Home`/`End` nhảy hai đầu.
- Mobile ≤ 620px: dải tab tự xuống 2 hàng, không tràn ngang (`scrollWidth == innerWidth`).
- **Tab dùng màu xanh `--link`, không dùng `--nav-active` (cam thương hiệu).** Đây là tab
  trong nội dung, phải đọc như một phần của mặt đọc; `--nav-active` dành cho chrome (gạch
  chân thanh điều hướng, badge). Đo WCAG: tab đang chọn 7.95:1 (sáng) / 6.68:1 (tối),
  tab thường 5.16:1 / 5.4:1 — đều đạt AA.
- **Panel không có `<h2 class="block-header">` riêng.** Nhãn tab phía trên đã là tiêu đề;
  lặp lại tên tab trong panel chỉ chiếm thêm một thanh màu xanh đậm và trông như hai tiêu đề
  trùng nhau. Chỉ khối ngoài cùng của trang còn `<h1 class="block-header">Cài đặt</h1>`.
  Số đếm từng đi kèm tiêu đề đó (số phím tắt, số album) chuyển thành dòng
  `<p class="settings-count" id="shortcut-count">` / `id="sticker-count">` ngay dưới dòng tab,
  vẫn cập nhật khi thêm/xoá. (Ô đếm cũ bị tìm bằng `document.querySelector('.block-header-extra')`
  — selector đó sẽ trúng nhầm sau khi bỏ tiêu đề, nên đổi sang id riêng.)

### Phím tắt thanh điều hướng

- Mỗi phím tắt là một cặp `{ id, name, url }`. `name` tối đa 40 ký tự, `url` phải là
  **http(s) tuyệt đối** hoặc đường dẫn nội bộ bắt đầu bằng `/`. `javascript:`, `data:`
  và URL có credentials bị từ chối.
- Danh sách hiển thị trên thanh nav (mục **Bài mới** mặc định đã bỏ), đúng thứ tự trong
  danh sách, trái sang phải rồi xuống dòng. Không giới hạn số lượng trên giao diện (chặn
  an toàn 200).
- Khi localStorage chưa có `voz-settings:v1`, danh sách mặc định là **F33**
  (`/f/diem-bao.33/`) và **F17** (`/f/chuyen-tro-linh-tinh.17/`). Mặc định chỉ để hiển
  thị: lần sửa đầu tiên (thêm/xoá/sửa/đổi thứ tự) sẽ ghi danh sách thật, nên xoá hết vẫn
  giữ trạng thái rỗng sau khi tải lại. `/new` vẫn mở trực tiếp bằng URL.
- Kéo thả hàng trong danh sách để đổi thứ tự; vị trí thả tính theo nửa trên/nửa dưới của
  hàng đích. Thứ tự lưu ngay vào localStorage.
- Nút bút chì nạp lại phím tắt vào form để sửa, nút thùng rác xoá.
- Nav dùng `flex-wrap` + `max-height: 40vh` + cuộn dọc, mỗi link cắt bằng ellipsis ở
  240px. Đã thử 14–22 phím tắt: desktop 2–3 hàng, mobile ~9 hàng, không tràn ngang
  (`scrollWidth == clientWidth`).
- Đổi ở tab khác tự cập nhật qua event `storage`; đổi trong trang qua event `voz:settings`.

### Giao diện (sáng / tối / phông chữ / cỡ chữ)

`ui/theme.js` + `lib/settings.js` + `css/theme.css` + `css/fonts.css`. Ba thiết lập độc lập
trong `/cai-dat-tuivoz` → **Giao diện**.

**Chế độ màu** (`theme`: `auto` | `light` | `dark`, mặc định `auto`). Chỉ đổi vùng **nội
dung**; thanh trên cùng, thanh điều hướng và footer giữ nguyên kiểu voz.vn ở cả hai chế độ —
nên các điều khiển nằm *trên* chrome (ô tìm kiếm ở header, avatar, màu chữ nav) được đóng
băng bằng token riêng `--chrome-*`, không đi theo bảng màu nội dung. Nếu để chúng đi theo,
ô tìm kiếm sẽ sáng trên nền tối khi bật chế độ tối — và ngược lại, ở chế độ sáng nó mất độ
tương phản với nền chrome tối.

- Cơ chế: `base.css` khai báo bảng **sáng** trong `:root`, rồi `:root[data-theme="dark"]`
  trỏ lại **cùng tên token** sang giá trị tối. Thành phần chỉ dùng `var(--token)`, không
  hardcode màu, nên bật/tắt chỉ là đổi một thuộc tính trên `<html>`.
- `auto` theo `prefers-color-scheme` và **theo tiếp khi hệ điều hành đổi** lúc tab đang mở
  (listener `change` chỉ áp dụng ở chế độ `auto`). `light`/`dark` cố định, bỏ qua hệ thống.
- `color-scheme` được đặt theo chế độ đã phân giải để widget gốc (scrollbar, ô nhập, nền
  canvas) khớp thay vì loé trắng.
- **Chống nhấp nháy:** script inline rất nhỏ trong `index.html`, đặt ngay sau `base.css` và
  trước các stylesheet layout, đọc localStorage rồi ghi `data-theme`/`data-theme-mode`/
  `data-font` + `--font` trong cùng lần tính style đầu tiên. `ui/theme.js` (`wireTheme()`)
  chỉ lo phần sau đó: đổi listener, đồng bộ khi có `voz:settings` từ tab khác.
- Ảnh/video/iframe trong chế độ tối bị giảm nhẹ `filter: brightness(.92)` để đỡ chói —
  **không** đảo màu; avatar, smilie, sticker, reaction được miễn để không mất màu gốc.
- Ngoại lệ: màu do tác giả bài viết đặt bằng `[COLOR=…]` là `style` inline trên nội dung,
  không thuộc hệ token. Giữ nguyên (không viết lại nội dung người dùng) nên một màu chữ tối
  do tác giả chọn có thể chìm trên nền tối — giống voz.vn.

**Phông chữ** (`font`: `system` | `roboto` | `be-vietnam-pro` | `be-vietnam`, mặc định `system`).

- Phông nằm trong repo tại `public/assets/fonts/`: 6 file woff2 của Roboto + Be Vietnam Pro
  dựng bằng `tools/build-fonts.py`, cộng **4 file của Be Vietnam** dựng bằng
  `tools/build-be-vietnam.py`, và hai tệp giấy phép `OFL.txt` + `OFL-BeVietnam.txt`.
- Roboto và Be Vietnam Pro được dựng từ font gốc OFL của Google Fonts: mỗi họ cắt còn
  `latin` + `vietnamese` ở 3 mức 400/500/700. Tổng ~186 KB thay vì ~1 MB bản đầy đủ, và
  dấu tiếng Việt (vốn là phần lớn nội dung) luôn được giữ đủ.
- Roboto ở upstream là variable font (`wght` 100–900, `wdth` 75–100) nên script
  **instance** ra ba mức tĩnh trước khi subset; Be Vietnam Pro upstream đã là file tĩnh.
- **Be Vietnam** (`be-vietnam`) là họ *tiền nhiệm* của Be Vietnam Pro, và là họ mà các
  userscript trên voz.vn dùng. Nguồn là repo upstream
  `github.com/bettergui/BeVietnam` v2.000 (7 mức + nghiêng, file `.ttf` tĩnh).
  - **Vì sao không dùng CDN nữa:** Google chỉ phát hành **một mức 400** của họ này. Bản đầu
    tiên chép 3 file đó về, hệ quả là chữ đậm bị trình duyệt **giả lập** (kéo ngang 4%) và
    chữ nghiêng là **nghiêng giả**. Đo trên trang thật: `font-weight: 600` và `700` ra cùng
    một bề rộng `189.82px`, tức hai mức đậm giống hệt nhau — trong khi username là 600 và
    một trang chủ đề có ~18 chỗ như vậy. Nay dựng thật 400/500/700 + italic 400.
  - **Bẫy name table:** chỉ `Regular`/`Bold`/`Italic` khai họ là `"Be Vietnam"`. Các mức
    khác tự nhận là họ riêng — `Medium` là `"Be Vietnam Medium"` **và** nameID 2 của
    Windows là `Regular`, nên trình duyệt thấy đó là một "regular" của họ khác chứ không
    phải mức 500. Script chuẩn hoá lại toàn bộ nameID 1/2/4/6/16/17 + `usWeightClass` +
    bit `fsSelection`/`macStyle`; đã kiểm chứng bằng cách đọc lại name table **trong file
    woff2 đã build**, không chỉ tin bản gốc.
  - **Một file cho mỗi mức, không `unicode-range`.** File build ra gộp cả `latin` +
    `vietnamese` giống Roboto/Be Vietnam Pro, nên không cần chia dải. Bản 400 chia dải cũ
    đã bị xoá (script tự xoá `be-vietnam-400-*.woff2`): nếu còn, `unicode-range` của chúng
    sẽ chồng một phần lên face 400 mới.
  - Tổng **121.3 KB** cho 4 file (từ 495.9 KB file gốc): 400 = 29.4 KB, 500 = 29.7 KB,
    700 = 31.5 KB, italic 400 = 30.7 KB.
  - Bản quyền: `OFL-BeVietnam.txt` chép từ thư mục nguồn, ghi "Copyright 2019 The Be Vietnam
    Project Authors". **Khác** `OFL.txt` của Be Vietnam Pro ("2021 … Pro Project Authors"),
    nên hai tệp tồn tại song song chứ không ghi đè nhau.
- **Chỉ tải khi người dùng chọn:** `css/fonts.css` chứa toàn bộ `@font-face` nhưng chỉ được
  chèn `<link>` từ `ui/theme.js` (`ensureFontStylesheet()`) ở lần chọn đầu tiên. Mặc định
  `system` không tải byte nào (đã kiểm chứng: 0 request tới `assets/fonts/`, không có
  `#font-faces`). `@font-face` khai báo `font-weight` tường minh vì tên họ nội bộ của file
  500 là "Roboto Medium" / "Be Vietnam Pro Medium".
- `FONT_STACKS` trong `lib/settings.js` là nguồn duy nhất cho stack chữ; `system` là `null`
  nên `--font` được gỡ về mặc định của `base.css`. Mọi stack đều kết thúc bằng một họ
  generic để chữ vẫn hiện nếu woff2 lỗi. Stack của `be-vietnam` trỏ `"Be Vietnam"` **không**
  kèm `Pro` — `vtesst1/settings-appearance.test.mjs` chặn việc để lẫn hai họ này.
- Link phông không bị gỡ khi quay lại `system` (tránh tải lại nếu người dùng đổi qua đổi
  lại); chỉ `--font` đổi.
- Thêm phông mới phải sửa **ba** nơi: `FONTS`/`FONT_LABELS`/`FONT_STACKS` +
  `css/fonts.css`, và nhánh tương ứng trong script chống nhấp nháy ở `index.html` (test
  `theme-tokens.test.mjs` đọc `FONT_STACKS` để kiểm tra chéo, nên quên script là fail).
- Chi tiết dựng lại font: chạy `python tuivoz/tools/build-fonts.py --src <thư mục .ttf>
  --out tuivoz/public/assets/fonts` cho Roboto + Be Vietnam Pro, và
  `python tuivoz/tools/build-be-vietnam.py --src <BeVietnam-master/ttf> --out tuivoz/public/assets/fonts`
  cho Be Vietnam. Cả hai cần `fonttools` + `brotli`. Script Be Vietnam tự xoá các file
  `be-vietnam-400-*.woff2` chia dải cũ (tắt bằng `--no-prune-legacy`).

**Cỡ chữ** (`postSize` + `uiSize`: phần trăm 80–200, bước 5, mặc định `100`).

Hai thanh trượt độc lập, đúng như tên gọi:

| Thiết lập | Field | Token | Áp cho |
|---|---|---|---|
| Cỡ chữ nội dung bài viết | `postSize` | `--post-scale` | `.message-body` (và chữ ký) |
| Cỡ chữ những chỗ khác | `uiSize` | `--ui-scale` | mọi thứ còn lại |

- **Cơ chế.** `base.css` khai báo `--ui-scale: 1` và `--post-scale: 1`. **Mọi** `font-size`
  dạng px trong `assets/css/*.css` được viết `calc(<px> * var(--ui-scale))`; riêng chữ
  trong bài dùng `calc(<px> * var(--post-scale))`. Thêm một `font-size: 14px` mới là bug —
  `vtesst1/font-scale.test.mjs` quét toàn bộ file CSS và fail nếu còn px trần.
- **Không đụng nhau.** `.message-body` đặt `font-size: calc(16px * var(--post-scale))`
  **và** `--ui-scale: var(--post-scale)` cho cây con của nó. Nhờ vậy một `<blockquote>` bên
  trong bài (`calc(15px * var(--ui-scale))`) đi theo thang của bài chứ không theo thang
  trang. Đo trên trang thật: 100% → body `16px`, quote `15px`; `postSize 150` → `24px` /
  `22.5px`, còn `.message-name` (chrome) vẫn `16px`.
- **Ranh giới.** Tên người gửi, ngày tháng, số bài, thanh nút hành động, dải cảm xúc, thẻ
  thành viên là **chrome** → `--ui-scale`. Chữ ký là văn bản do người dùng viết → `postSize`.
- **Sliders.** `min`/`max`/`step` lấy từ `FONT_SCALE_MIN/MAX/STEP` trong `lib/settings.js`.
  `input` áp ngay (xem trước khi kéo), `change` mới bắn toast — nếu không, một lần kéo sẽ
  bắn hàng chục toast.
- **Chống nhấp nháy.** Script inline ở `index.html` đặt `--post-scale`/`--ui-scale` trước
  lần vẽ đầu, cùng chỗ với `data-theme`/`--font`; `ui/theme.js` (`applyFontScale()`) chỉ lo
  phần sau đó. F5 ở 150% không thấy nhấp sang 100%.
- **Bẫy `Number()`.** `Number(null)`, `Number('')` và `Number([])` đều là `0` — sẽ kẹp về
  sàn 80% thay vì về mặc định. `normalizeFontScale()` chỉ nhận number hoặc chuỗi số, còn
  lại trả 100%. Test chặn đúng các giá trị này.
- **`--font` phải là alias.** Để `--font: <stack>` (giá trị trực tiếp) thì nó **thắng**
  `--font-post` ngay bên trong `.message-body`, và tùy chọn phông riêng cho bài sẽ chết
  lặng. Vì vậy `base.css` có `--font-post` và `--font-control` (cùng giá trị mặc định) và
  `--font: var(--font-control)` — `ui/theme.js` chỉ ghi `--font`, nội dung bài giữ nguyên
  `--font-post`. Phông chữ dùng chung cho cả site (một thiết lập), nhưng tách token để việc
  ghi đè không vô hiệu hoá nhánh bài viết.

**Độ tương phản.** Toàn bộ vùng nội dung được đo bằng công cụ chạy trong trình duyệt (đọc
`getComputedStyle`, tự tìm nền đục gần nhất ở tổ tiên, tính tỉ lệ WCAG, xét ngưỡng 4.5 cho
chữ thường và 3.0 cho chữ lớn). 13 view × 2 chế độ đều **0 lỗi**. Vài giá trị gốc của voz.vn
đã phải chỉnh để đạt AA:

| Token | Trước | Sau | Lý do |
|---|---|---|---|
| `--dimmed` (sáng) | `#8a8e93` (3.02 trên `#f4f5f5`) | `#606569` | chữ phụ trên 5 nền sáng khác nhau; đây là mức nhạt nhất còn đạt 4.5 ở mọi nền (xấu nhất 4.53) |
| `--dimmed-2` (sáng) | `#6b7075` (4.37 trên `#eef0f1`) | `#63686d` | số nhảy trang trên `--content-bg-alt` |
| `--link-hover` (sáng) | `#ff6600` (2.69) | `#a84300` | cam hover của voz.vn không đạt AA **khi dùng làm màu chữ**; sắc cam nguyên bản vẫn giữ cho `--nav-active` và badge/CTA trên chrome |
| `--accent-text` (mới) | — | `#a84300` / `#ffb070` | chữ ở trạng thái "đã thả cảm xúc" (`--nav-active` chỉ dùng trên chrome) |
| `--block-header-fg` (sáng) | `#ebecED` (4.19) | `#f2f4f8` | chữ trên nền header block |
| `--chrome-dimmed` (mới) | — | `#adb3bb` | `--dimmed` trước đây bị dùng cho breadcrumb/sentinel nằm trên **nền trang tối** ở cả hai chế độ |
| `.button--cta` | `#ff944c` (2.19) | `#c24d15` | nút "Tạo chủ đề mới", trắng trên nền quá sáng |
| `avatar.js` | `#206020`/`#1f2e1f`… | `#0d2b0d`/`#0a140a`… | chữ cái đầu trên avatar sinh tự động, đưa cả 7 cặp lên 5.3–7.9 |

`vtesst1/theme-tokens.test.mjs` khoá lại hợp đồng này: token trong bảng tối phải tồn tại ở
bảng sáng, mọi token thuộc vùng nội dung phải được trỏ lại ở chế độ tối (danh sách đóng băng
`--header-*`/`--nav-*`/`--footer-*`/`--chrome-*`/`--overlay-*` được miễn), thành phần không
được tham chiếu token không tồn tại, và script chống nhấp nháy phải phủ đủ mọi lựa chọn.

### Cuộn trang liên tục

`ui/infiniteScroll.js` + `lib/settings.js` (`infiniteScroll`: `on` | `manual` | `off`,
mặc định `manual`). Áp dụng cho **danh sách chủ đề** (`/f/…`, `/s/…`) và **trong chủ đề**
(`/t/…`) — hai nơi có phân trang thật.

- **Bật (`on`)** — khi cuộn tới cuối danh sách, trang kế được tải và **nối thêm** vào
  cuối (không render lại trang), nên vị trí cuộn và nội dung phía trên không nhảy.
  URL cập nhật bằng `replaceState` sang `page-N` của trang vừa nối, khớp với số trang
  đang hiển thị ở đáy.
- **Kích hoạt theo người dùng yêu cầu (`manual`)** — thanh số trang có thêm nút icon
  `⇣` (`.pageNav-scrollBtn`, cùng nền `#dfe7f6`/màu `--link` như các ô số trang bên
  cạnh, `title`/`aria-label` "Bật cuộn liên tục cho trang này"). Cuộn **không** tự tải gì
  cho tới khi bấm nút; sau khi bấm thì cuộn
  tiếp tục nối trang như chế độ `on`. Trạng thái "đã bật" chỉ sống trong trang hiện tại:
  **F5 hoặc sang trang khác đều phải bấm lại**, đúng yêu cầu "luôn cần thao tác người dùng".
  Đây là mặc định.
- **Tắt (`off`)** — không có sentinel, không có nút, không tự tải; chỉ dùng thanh số trang.
- Nối trang: danh sách chủ đề chèn vào `.structItemContainer-group` không-sticky (sticky
  chỉ ở trang 1); chủ đề chèn vào `#post-list` và đăng ký lại attachment + tooltip thành
  viên + thanh cảm xúc cho từng trang mới. Con trỏ click bài viết dùng `postIndex` cấp
  module nên bài ở trang nối vẫn sửa/trích dẫn/xoá được.
- Chống nối oan: observer chỉ hành động **sau khi người dùng đã cuộn** ít nhất một lần,
  nên cửa sổ cao không nối hàng loạt trang ngay khi mở. Lỗi tải trang dừng vòng lặp và
  hiện thông báo đỏ ở sentinel.
- Sentinel `.infinite-sentinel` nằm **sau** thanh số trang, hiện `Trang N / M` hoặc
  spinner khi đang tải. Chỉ tồn tại một sentinel; `teardownInfiniteScroll()` gọi ở đầu
  `route()` nên đổi trang không để lại rác.
- **Nút dừng nổi `.infinite-stop`.** Mỗi khi việc nối trang đang bật — cả chế độ `on`
  (bật sẵn từ đầu) lẫn `manual` (sau khi bấm `⇣`) — góc phải dưới hiện **một** nút tròn
  chỉ có icon `✕` (`right: 16px`, `bottom: calc(64px + safe-area)`, 40×40, nền
  `--block-header-bg`, `z-index: 40`; mobile ≤620px còn 38×38 và `bottom` 72px). Nút nằm
  ngoài thanh số trang nên vẫn với tới khi danh sách dài ra. Bấm nút gọi
  `disarmInfiniteScroll()`: **dừng nạp trang tiếp theo nhưng giữ nguyên các trang đã nối**
  và vị trí cuộn, đồng thời trả nút `⇣` trên pager về trạng thái chờ để bật lại. Không
  bao giờ có quá một nút: `showStopButton()` thoát sớm nếu nút đã tồn tại, và cả nút lẫn
  sentinel đều bị `teardownInfiniteScroll()` gỡ khi `route()` chuyển trang.
- **Nút dừng ẩn khi cuộn xuống.** Cuộn xuống ⇒ thêm class `is-hidden`
  (`opacity: 0`, `translateY(8px) scale(.9)`, `pointer-events: none`); cuộn lên ⇒ hiện
  lại. Ngưỡng `REVEAL_THRESHOLD` 8px để trackpad/rubber-band không nhấp nháy; không ẩn
  khi còn ở sát đầu trang (`y > 8`), và chỉ ẩn khi `delta > 0`. Nút **vẫn nằm trong DOM**
  và vẫn `focus-visible` được (khi focus thì hiện lại), chỉ là không vẽ ra. Nút ẩn **không**
  dừng việc nối trang — cuộn xuống vẫn tải tiếp, đó là mục đích của việc ẩn.
- Mobile ≤ 620px: pager thu gọn padding/cỡ chữ để vẫn một hàng cùng nút cuộn; ≤ 400px chỉ
  giữ số trang hiện tại và hai số kề, ẩn dấu `…`. Đã kiểm 390px: `scrollWidth == 390`,
  pager cao 26px (một hàng), nút nằm trong pager.

### Sticker

Port từ userscript "Voz Emoji" v2.3 (Fioren) — cùng bộ tính năng, nhưng lưu bằng
`localStorage` thay cho `GM_setValue` và dùng chung popup với emoji thay vì modal riêng.

- Nút **Sticker** nằm cạnh **Emoji** trên thanh công cụ. Popup có tab album +
  **Gần đây**; chọn sticker chèn `[IMG size="80x80"]<url>[/IMG]` và **không đóng popup**
  để chèn liên tiếp, giống emoji. Ô sticker phóng to 1.05 khi rê chuột; popup **Emoji**
  dùng cùng hiệu ứng (phóng 1.25 + nền xám nhạt) để hai picker có cảm giác giống nhau.
- Tab **Gần đây** có nút xoá tất cả dạng **chỉ icon 🗑️** (26×26px, `title`/`aria-label`
  "Xoá hết gần đây"), không còn chiếm cả một hàng chữ rộng.
- Khoá lưu: `voz-stickers:v1` (album), `voz-stickers:recent:v1` (tối đa 30, mới nhất
  trước, khử trùng theo URL). **Không còn** khoá `voz-stickers:clientId:v1`: imgur
  Client-ID là hằng số `66850c248e91c93` (`DEFAULT_CLIENT_ID`) và `getClientId()` luôn trả
  về nó — xem mục *imgur Client-ID cố định* bên dưới.
- Album có `{ id, name, type, preview, images[], savedAt }`; mỗi ảnh
  `{ url, base64, deleteUrl }`. `type` là `imgur` (nhập từ album imgur) hoặc `pikvn`
  (tạo từ ảnh tự chọn). Ảnh thu nhỏ tối đa 400px và mã hoá WebP 0.8; GIF giữ nguyên.
- Thêm album imgur: dán `https://imgur.com/a/<slug>-<id>` hoặc `https://imgur.com/a/<id>`,
  ảnh tải song song 5 cái một lô rồi lưu base64. Gọi qua proxy `/api/xf/imgur/album/{id}/images`
  (userscript dùng `GM_xmlhttpRequest` để né CORS; trang web không né được nên phải qua proxy).
- Tạo album từ ảnh: chọn nhiều tệp, mỗi tệp thu nhỏ rồi lưu base64 ngay trên máy.
- **📥 Nhập album từ JSON**: chọn một hoặc nhiều tệp `.json` (hoặc dán JSON trực tiếp).
  Nhận cả file do nút *Xuất album* của trang này tạo lẫn file export của userscript
  (`{ version, exportDate, addOnly, albums }`). File có `addOnly: true` (một album) chỉ
  **thêm** album mới và bỏ qua album trùng tên; file sao lưu đầy đủ
  (`{ albums, recent }`) thay thế album và sticker gần đây. Khoá `clientId` trong file cũ
  được **bỏ qua** (không còn khái niệm Client-ID tuỳ chỉnh), nên file backup cũ vẫn nhập được.
- Quản lý: kéo thả đổi thứ tự album, xoá từng album, chọn nhiều rồi **Xoá album đã chọn**,
  xuất riêng một album (file `addOnly` — nhập lại chỉ thêm, bỏ qua album trùng tên).
- **Sửa album** (`openAlbumEditor`): nút ✏️ và nút 🖼️ trong mỗi hàng mở **cùng một hộp thoại**
  — đổi tên và sắp xếp sticker là một việc, tách làm hai chỉ khiến phải mở hai lần. Hộp thoại
  có ô tên album và lưới toàn bộ sticker, **kéo thả** để đổi vị trí, `✕` để bỏ một ảnh, badge
  số thứ tự tự đánh lại. **Lưu thay đổi** ghi cả tên lẫn thứ tự; **Huỷ**/`✕`/bấm nền bỏ hết.
  Thứ tự lưu vào `album.images` chính là thứ tự hiển thị trong bảng chọn sticker và ảnh đầu
  tiên trở thành `preview` của hàng trong danh sách.
  - Thao tác trên **bản nháp cục bộ**: kéo thả chỉ đổi mảng trong bộ nhớ, không ghi
    localStorage cho tới khi bấm Lưu — nên Huỷ trả lại đúng thứ tự cũ (đã kiểm chứng).
  - Tên được chuẩn hoá khoảng trắng + `trim`; tên rỗng hiện lỗi ngay trong hộp thoại và
    **không** ghi gì. Album không còn ảnh nào cũng bị chặn (muốn xoá cả album thì dùng nút
    thùng rác ở danh sách).
  - Đổi tên chạy **trước** `setAlbumImages`; nếu tên bị từ chối thì ảnh cũng không bị lưu,
    tránh trạng thái nửa vời.
  - Trước đây hai chức năng này hỏng: nút ✏️ dùng `window.prompt`, còn nút 🖼️ dựng
    `.confirm-modal` / `.confirm-box` — **hai class này không hề có CSS nào**, nên hộp thoại
    render như một khối tĩnh nằm cuối trang, không nền, không `z-index`, không scrim. Nay dùng
    `openModal()` trong `ui/modal.js` (backdrop `fixed` + `z-index: 1000` + `var(--scrim)`),
    chỉ thêm tham số `{ className }` để mở rộng 780px cho vừa lưới ảnh.
  - Trên thiết bị cảm ứng (`@media (hover: none)`) nút `✕` luôn hiện; trên desktop nó hiện
    khi rê chuột hoặc focus bàn phím.
- Xoá album `pikvn` chỉ xoá dữ liệu trong trình duyệt; ảnh đã tải lên máy chủ vẫn còn
  (khác userscript ở chỗ không có mkdir/xoá server).

#### imgur Client-ID cố định

Trước đây panel Sticker có ô **imgur Client-ID** + hai nút *Lưu* / *Về mặc định*, lưu ở
`voz-stickers:clientId:v1`. Đã bỏ hoàn toàn:

- Người dùng thường không có app imgur riêng, nên nhập key bừa chỉ nhận `403` — trường đó chỉ
  tạo ra lỗi.
- **Proxy cũng không còn nhận `client_id` từ query string.** Trước đây `api/[...path].js`
  đọc `?client_id=` và gắn vào header `Authorization: Client-ID …`, nên bất kỳ ai cũng có thể
  mượn proxy của trang này để tiêu quota của một app imgur bất kỳ (và tham số đó nằm ngay
  trong URL nên lộ trong log). Nay proxy dùng hằng số `IMGBUR_CLIENT_ID` phía server; query
  `?client_id=` bị bỏ qua (đã kiểm chứng: gọi kèm `client_id=deadbeef` vẫn trả 200 như khi
  không kèm).
- `getClientId()` giữ lại dạng hàm để call site đọc như "key đang dùng" và để sau này đổi giá
  trị chỉ ở một chỗ, nhưng luôn trả `DEFAULT_CLIENT_ID`, kể cả khi localStorage còn rác từ
  bản cũ.

### Tải ảnh lên pik.vn

Port từ nhánh `5.pik.vn` của userscript, nhưng **không dùng iframe + `postMessage`** nữa.

- `pik.vn` đã đổi từ `5.pik.vn` sang `https://pik.vn` và bỏ Cloudflare Turnstile: uploader
  giờ chỉ là `POST /api/upload` multipart (`file` + `hash` + `format`), không cần token.
  Site vẫn **không gửi header CORS**, nên trang không gọi trực tiếp được → đi qua proxy
  riêng `POST /api/pik/upload` (`api/[...path].js`), proxy chuyển tiếp nguyên body multipart
  và trả lại JSON `{ url, deleteUrl, exists }`.
- Máy chủ pik.vn chỉ nhận **WebP** (GIF bị từ chối `not a webp image`), và trường `hash`
  phải là **SHA-256 của đúng bytes gửi lên**, nếu không trả `hash mismatch`. Ảnh được nén
  lại trước khi gửi: cạnh dài tối đa **1920px**, WebP **0.85** (JPEG 0.75 nếu trình duyệt
  không mã hoá được WebP — giống cách pik.vn tự chọn). Giới hạn ảnh gốc 16384px, 12 MB.
  GIF mất animation vì bị chuyển thành WebP.
- Ba đường vào: nút **Ảnh từ URL** trên thanh công cụ (panel có cả ô URL và dải
  *Chọn ảnh hoặc kéo thả vào đây*, nên không còn nút **Tải ảnh lên** riêng), **Ctrl+V**
  dán ảnh trong khung soạn, và **kéo thả** tệp ảnh vào khung soạn. Cả ba dùng chung
  `uploadImageFiles()` (3 ảnh song song) và chèn `[IMG]<url>[/IMG]`, ảnh hiện ngay trong
  editor như sticker.
- Panel ảnh **không tự đóng** sau khi tải ảnh để tải tiếp nhiều đợt, giống popup sticker;
  mỗi ảnh có một dòng trạng thái thành công/lỗi, tệp không phải ảnh bị bỏ qua và báo số lượng.
  Dải kéo thả chỉ cao ~30px (một dòng), danh sách kết quả hiện ra sau khi bắt đầu tải.
- Dán văn bản thường vẫn chèn text như cũ; chỉ khi clipboard có mục `image/*` mới upload.
  Ở chế độ BBCode (`textarea`) không upload, chỉ báo chuyển về chế độ soạn thảo.
- Ảnh đã tải lên vẫn còn trên pik.vn khi xoá khỏi bài viết; `deleteUrl` chỉ dùng được
  bằng một `POST` tới chính URL đó.

### Sao lưu / phục hồi

JSON có dạng (có album thì `version` là `"1.2"`, giống userscript):

```json
{
  "app": "voz-web",
  "version": "1.2",
  "exportedAt": "2026-11-07T15:18:42.433Z",
  "navShortcuts": [{ "id": "s1abcde", "name": "Overclock", "url": "https://voz.vn/f/…" }],
  "infiniteScroll": "manual",
  "albums": [
    {
      "id": "a1abcde",
      "name": "Pepe",
      "type": "imgur",
      "link": "https://imgur.com/a/xxxxxxx",
      "albumId": "xxxxxxx",
      "preview": "data:image/webp;base64,…",
      "images": [{ "url": "data:image/webp;base64,…", "base64": "data:image/webp;base64,…", "deleteUrl": null }],
      "savedAt": "2026-11-07T15:20:00.000Z"
    }
  ],
  "recent": [{ "url": "https://i.imgur.com/….png", "base64": "data:image/webp;base64,…" }]
}
```

| Nút | Việc làm |
|---|---|
| **Xuất JSON** | đổ JSON (phím tắt + album sticker + gần đây) vào ô textarea |
| **Tải tệp .json** | tải `voz-settings-YYYY-MM-DD.json` |
| **Phục hồi từ JSON** | đọc ô textarea, kiểm tra hợp lệ rồi ghi đè toàn bộ (báo số phím tắt + album đã nạp) |
| **Xoá toàn bộ thiết lập** | có `confirm()`, xoá cả phím tắt, album và gần đây |

File backup của userscript nhập được nguyên vẹn: JSON chỉ cần có mảng `albums` cũng chấp
nhận (không bắt buộc `navShortcuts`). Khoá `clientId` trong file userscript cũ bị bỏ qua.
File một album (`addOnly: true`) chỉ **thêm** album
mới, bỏ qua album trùng tên, không ghi đè.

Phục hồi bỏ qua mục không hợp lệ (tên rỗng hoặc URL sai) và báo lỗi khi JSON hỏng hoặc
không có mảng `navShortcuts` lẫn `albums`.

---

## 8. Giới hạn đã biết

| Giới hạn | Chi tiết |
|---|---|
| Không tạo chủ đề mới ở mọi diễn đàn | `views/compose.js` + `POST /threads/` đã nối cho `/f/{slug}.{id}/post-thread`, nhưng diễn đàn có `require_prefix` thiếu tiền tố, `min_tags > 0` hoặc `custom_fields` thì UI chặn và mở form trên voz.vn. Chưa chạy thử đăng thật. |
| Không upload file | `POST /api/attachments/` luôn `404` dù có scope `attachment:write`. Đường duy nhất là route web `/attachments/upload` cần cookie session + `_xfToken`, không dùng được với bearer token. |
| Không đăng ký tài khoản | API không có endpoint register. |
| Không sửa profile | `POST /me/avatar`, `/me/password`, `/me/email` tồn tại nhưng chưa chạy thử (đổi thông tin đăng nhập). |
| Không tìm user theo danh sách | `GET /users/` trả `403`. Chỉ tìm được bằng `find-name` (khớp chính xác username). |
| `order` của `/threads/` | Chỉ `post_date` thay đổi kết quả; các giá trị khác trả về mặc định. |
| Bookmark / watch | Chỉ có dưới tiền tố `/voz/`, không có ở đường XenForo chuẩn. |
| Không có thông báo realtime | Phải tải lại trang; API không có SSE/WebSocket. Badge chỉ cập nhật khi focus/đổi tab/mỗi 60 s. |
| Cookie không mã hoá | `voz_session` là base64url của JSON token, không phải JWT ký. Ai có cookie là có token — chấp nhận được vì cookie `HttpOnly` + `Secure`, nhưng không phải giải pháp bảo mật cao. |
| Dải cảm xúc phụ thuộc CORS | Tên người thả cảm xúc lấy từ HTML `/p/{id}/reactions`; nếu trình duyệt chặn đọc body thì dải tự biến mất, chỉ còn số lượng trên nút. |
| `api.createPost()` / `api.stats()` | Có khai báo trong `api.js` nhưng không dùng; form trả lời gọi `fetch` trực tiếp để gửi `silent`. |
| `fetchReactionUsers()` ở edge | Đã viết trong `api/[...path].js` (cache 60 s) nhưng chưa có route nào gọi — Cloudflare vẫn chặn fetch server-side. |
| `sanitizeHtml` cho chữ ký / about / DM | Gọi không kèm `bbcode`, nên spoiler, link quote và kích thước ảnh không được khôi phục ở các chỗ đó. Chữ ký thì được render BBCode trước (`lib/signature.js`, §6.0b) nên thẻ hiện đúng. `about` của hồ sơ là văn bản thuần ở các hồ sơ đã kiểm tra (URL trần, không có thẻ) nên chưa cần đổi. |
| Bỏ qua thành viên | Không làm được qua API — route `/u/<slug>.<id>/ignore` là web-only, cần cookie session + `_xfToken`. Link `…/ignore` trong bài được giữ nguyên và mở sang voz.vn ở tab mới. |
| Cuộn khi bấm link nội bộ trong bài | `navigate()` gọi `window.scrollTo(0)` rồi view `scrollIntoView({block:'center'})` sau khi render. Bài cao hơn màn hình thì `block:'center'` đặt mép trên ở `-(cao-màn)/2`; đúng chuẩn nhưng trông như chưa cuộn nếu chỉ đo mép trên. |
| `history.scrollRestoration` | Đặt `'manual'` trong `core/nav.js`: trình duyệt khôi phục vị trí cuộn **sau** các lệnh cuộn của app và sẽ đè lên vị trí bài được focus. |
| `views/thread.js` render hai lần khi gửi bài | `navigate()` đã gọi `route()`, sau đó code gọi thêm `viewThread(threadId, 'last', post_id)` để chắc chắn ở trang cuối. |
| `page === 'last'` | Không phải shortcut API: tải trang 1, đọc `last_page`, rồi gọi lại — tốn thêm một request. |
| Cờ "đã đọc" của alert | `views/lists.js` kiểm tra `a.read_date`, còn `ui/headerMenus.js` kiểm tra `!item.view_date` — hai chỗ dùng hai tên trường khác nhau cho cùng một khái niệm. Cần đối chiếu response thật trước khi sửa. |

---

## 9. Kiểm thử đã chạy

Tất cả trên `http://localhost:3111` với một tài khoản thử, sau đó dọn dẹp. Không ghi lại
username, user id, thread id hay post id thật của bất kỳ ai.

| Chức năng | Kết quả |
|---|---|
| Trang chủ | 61 node render đúng cây |
| Forum `/f/<id>` | 24 item (4 sticky + 20), pager `1/490` |
| Thread `/t/<id>` | 20 bài, BBCode + quote render, 40 nút cảm xúc |
| `?page=last` | nhảy đúng trang cuối của một thread nhiều trang |
| Đăng nhập OAuth | popup → code → exchange → cookie → "Xin chào" |
| Trả lời | post mới xuất hiện, nhảy tới đúng bài |
| Trích dẫn | sinh đúng 1 block `[QUOTE="…, post: …, member: …"]` |
| Sửa bài | editor tại chỗ trong bài (không modal) → lưu → thân bài + "Đã sửa" cập nhật, không reload |
| Chủ đề chưa đọc | danh sách in đậm tiêu đề; mở trang cuối → `POST /threads/{id}/mark-read` → quay lại danh sách hết đậm |
| Xoá bài | confirm → biến mất, `reply_count` giảm |
| Cảm xúc | Ưng: `insert` → `.has-reaction`; bỏ: `delete` → mất `.has-reaction` |
| Số bài | `position` 0-based → hiển thị `#1`, `#2`, `#3`… |
| Theo dõi | icon con mắt trong thanh xanh, `watch`/`unwatch` đổi màu + tooltip |
| Phân trang trên | `ul.pageNav-main`, trang hiện tại chữ cam, không vỡ layout |
| Icon trích dẫn / trả lời | SVG, click vẫn chèn quote và focus textarea |
| Ảnh có size | `[IMG size="80x80"]` render đúng 80×80 (trước đó 512×512) |
| Ảnh `width=` | `[IMG width="150px"]` và `[ATTACH width="345px"]` đúng |
| Footer bài ngắn | `margin: auto 0 0` → gap đáy = 0 trên cả 16 bài của trang |
| DM trả lời | 1 → 2 tin nhắn |
| DM mới | tìm một thành viên → gửi → mở conversation mới |
| Tìm kiếm | một từ khoá phổ biến → nhiều trang kết quả |
| Alerts / Bookmarks / Watched | 22 / 20 / 2 mục |
| Trang cá nhân | render đúng thống kê, nút "Gửi tin nhắn" |
| Đăng xuất | cookie xoá, DM và form trả lời bị chặn |
| Mobile 420px | footer không tràn, mọi nút vẫn hiện |
| URL sạch | `/t/<slug>.<id>/page-<n>/`, không còn `#`; reload deep link OK |
| Slug khớp voz.vn | so 20 thread thật → 20/20 khớp `view_url` |
| Back/forward | `popstate` khôi phục đúng trang |
| Legacy hash | `/#/t/<id>?page=5` → `/t/<id>/page-5/` |
| Legacy không slug | `/t/<id>/` vẫn parse đúng |
| Fragment `#post-` | click link `#post-<id>` → scroll tới bài, URL giữ fragment |
| Nhảy bài chưa đọc | `/t/<slug>.<id>/unread` → `page-615/#post-44151561`, khớp đúng URL voz.vn cho cùng chủ đề |
| Unread, chủ đề chưa từng mở | `visitor_read_date: null` → về trang 1, không fragment |
| Unread, chủ đề đã đọc hết | về trang 1, không fragment (`#post-null` không xuất hiện) |
| Unread + Back | `replaceState` nên Back về danh sách, không quay lại URL `/unread` |
| Nút dừng nổi | bật cuộn → `.infinite-stop` xuất hiện (40×40, cách phải 16px, cách đáy 64px, mobile 38×38/72px); bấm → nút biến mất, **không** nối thêm trang, URL đứng yên, nút `⇣` trở lại trạng thái chờ |
| Nút dừng, ẩn/hiện | cuộn xuống ⇒ `is-hidden` (`opacity: 0`, `pointer-events: none`); cuộn lên ≥8px ⇒ hiện lại; rung 4px không đổi trạng thái |
| Nút dừng, ẩn vẫn nối trang | cuộn xuống liên tục ⇒ URL vẫn sang `page-N` dù nút đang ẩn |
| Nút dừng, không nhân bản | arm → FAB → disarm lặp 3 lần ⇒ luôn đúng 0 hoặc 1 nút |
| Nút dừng, chế độ `on` | nút có sẵn từ lúc mount (chế độ `on` không có nút `⇣`); bấm nút cũng dừng nạp |
| Nút dừng, số lượng | đúng 1 nút ở danh sách lẫn trong chủ đề (chủ đề render 2 pager) |
| Nút dừng, rời trang | điều hướng trong app → không còn `.infinite-stop` lẫn `.infinite-sentinel` |
| Giao diện, mặc định | `/cai-dat-tuivoz` → "Tự động theo hệ thống" được chọn, `data-theme` = light hoặc dark theo OS |
| Giao diện, `auto` theo OS | đổi `prefers-color-scheme` lúc tab đang mở → `data-theme` đổi ngay, không reload |
| Giao diện, Sáng/Tối | chọn Tối → `data-theme="dark"`, `color-scheme: dark`, lưu vào localStorage |
| Giao diện, không nhấp nháy | F5 khi đang Tối → `data-theme` có sẵn từ script inline, nền `#1b1f24` ngay lần vẽ đầu |
| Giao diện, tương phản | 13 view × 2 chế độ, đo WCAG bằng getComputedStyle → 0 lỗi (4.5 chữ thường / 3.0 chữ lớn) |
| Giao diện, mobile | 390px: card xếp dọc, `scrollWidth == innerWidth`, không tràn ngang |
| Cỡ chữ, mặc định | cả hai thanh trượt ở `100%`, `--post-scale`/`--ui-scale` = `1`, body `16px` |
| Cỡ chữ, áp riêng | `postSize 150` + `uiSize 120` ⇒ body `24px`, `.message-name` `19.2px`, chữ ký `18px`, quote trong bài `22.5px` |
| Cỡ chữ, chrome tách bài | `postSize 150`/`uiSize 100` ⇒ body `24px` nhưng `.message-name`, `.actionBar-action`, dải cảm xúc vẫn `16px`/`14px`/`12px` |
| Cỡ chữ, không nhấp nháy | F5 ở 150% → `--post-scale` có sẵn từ script inline trước lần vẽ đầu |
| Cỡ chữ, giới hạn | kéo tới `80%` và `200%`: `scrollWidth == innerWidth` ở 1265px lẫn 390px, nav không tràn |
| Cỡ chữ, nhãn `em` | `.label` (prefix) `12.8px` ở 100%, `28.8px` ở `uiSize 150` — không nhân hai lần |
| Cỡ chữ, lưu bền | reload ở 130%/90% → thanh trượt và `--*-scale` khôi phục đúng, backup JSON mang cả hai key |
| Unfurl, favicon chết | card discord.com ở 100%/**150%**/200% ⇒ cao **131/206/306px** (trước khi sửa: 397px ở 150%); icon bị ẩn khỏi layout, không còn alt text dựng cột |
| Unfurl, ảnh preview | thumbnail thật vẫn 80×80 (màn hẹp 60×60) với `object-fit: cover`; ảnh 1×1 cũng bị kéo đầy khung, không phình card |
| Unfurl, ngoài `.bbWrapper` | chèn card vào `<div>` trần ⇒ chiều cao/icon y hệt — selector không phụ thuộc container |
| Unfurl, mobile | 390px ở 150%: card 346px, nằm trong `.message-cell--main`, `scrollWidth == innerWidth` |
| Phông, mặc định | `system` → **không** có `<link id="font-faces">`, không tải file font nào |
| Phông, chọn Roboto | link `fonts.css` được chèn, `--font` đổi, `document.fonts` báo Roboto 400/500/700 `loaded` |
| Phông, chọn Be Vietnam Pro | vẫn đúng **1** link (không nhân bản), stack đổi sang `"Be Vietnam Pro"` |
| Phông, quay lại hệ thống | `--font` inline bị gỡ, về stack mặc định của `base.css`; link giữ lại để không tải lại |
| Phông, tiếng Việt | `Đặng Hữu Phước ợ ẹ ẵ ộ ữ` render đủ, không tofu, ở cả 3 mức |
| Phông, file | 6 woff2 tải 200, kích thước khớp bản dựng (31/29 KB), `OFL.txt` 200 |
| Tab cài đặt, mặc định | không có fragment → tab `Giao diện`, đúng 1 panel hiện |
| Tab cài đặt, click | chuyển panel + `#id` trên URL, chỉ 1 panel hiện, `aria-selected` đúng |
| Tab cài đặt, deep link | F5 ở `#stickers` → mở đúng tab Sticker; hash lạ → về tab đầu |
| Tab cài đặt, panel ẩn vẫn chạy | đổi theme/phông/cuộn, thêm phím tắt, xuất JSON, form sticker — tất cả hoạt động khi panel đang ẩn |
| Tab cài đặt, bàn phím | `←`/`→` chạy vòng (backup → appearance), `Home`/`End`, focus đi theo, `tabindex` xoay vòng |
| Tab cài đặt, link từ picker | click `/cai-dat-tuivoz#stickers` (kể cả khi đang ở trang cài đặt) → mở tab Sticker |
| Tab cài đặt, mobile | 390px: dải tab 2 hàng, `scrollWidth == innerWidth`, không tràn ngang |
| Tab cài đặt, tương phản | 5 panel (mở hết) + dải tab × 2 chế độ → 0 lỗi WCAG; tab đang chọn 7.95:1 sáng / 6.68:1 tối, tab thường 5.16 / 5.4 |
| Tab cài đặt, màu | tab đang chọn `rgb(35,73,123)` = `--link` (xanh) ở cả hai chế độ, không còn `--nav-active` cam |
| Tab cài đặt, tiêu đề trùng | cả 5 panel đều **0** `.block-header` bên trong; chỉ khối ngoài còn `<h1>Cài đặt</h1>` |
| Tab cài đặt, ô đếm | thêm 1 phím tắt qua form → `2 phím tắt` → `3 phím tắt`; xoá album qua nút → `1 album` → `0 album` |
| imgur Client-ID | không còn `#sticker-client-id`, `#sticker-client-save`, `#sticker-client-reset` trong DOM |
| imgur proxy, không `client_id` | `GET /api/xf/imgur/album/saitlzr/images` → **200**, `success: true` |
| imgur proxy, `client_id` rác | `…?client_id=deadbeef` → vẫn **200** (tham số bị bỏ qua, dùng key phía server) |
| imgur nhập album, end-to-end | nhập `https://imgur.com/a/liverpool-emoticons-saitlzr` → tạo album `PepeTest`, tải ảnh xong, không lỗi |
| Sao lưu, khoá JSON | `settings-export` → `app, version, exportedAt, navShortcuts, infiniteScroll, theme, font`; **không** có `clientId`; phục hồi lại → "Đã phục hồi: 3 phím tắt" |
| Logo header | `/assets/img/voz-lockup.svg` tải 200, natural 348×177, render 51×26 (đúng tỉ lệ 1.963), không chồng lên ô tìm kiếm/tài khoản |
| Logo header, mobile | 390px: vẫn 51×26, không tràn ngang, header 45px |
| Ô tìm kiếm header | đã xoá — `document.querySelector('.p-header-search')` trả `null`, không còn tham chiếu nào trong HTML/CSS/JS |
| Icon Tìm kiếm header | bấm icon kính lúp → menu mở ở `top: 48`, không bị nav che (`elementFromPoint` 0 điểm lệch); nhập “cuộn liên tục” và submit → `/search?q=cu%E1%BB%99n+li%C3%AAn+t%E1%BB%A5c&member=`, 162 kết quả thật |
| Icon Tìm kiếm, mobile | 390px: vẫn hiện (30×30) cùng Hộp thư / Thông báo; không tràn ngang |
| Chiều cao hai thanh | desktop 46px header + 36px nav = `--chrome-h` 82px; mobile 45 + 36 = 81px; `scroll-padding-top` khớp từng nơi |
| Footer | đúng 1 `<p>`: “Voz của tui, xài voz theo cách của tui”, không còn câu cũ |
| Thanh tự ẩn, cuộn xuống | header `top: -46`, nav `bottom: 0` (khuất hẳn), `chrome-hidden` bật |
| Thanh tự ẩn, cuộn lên | hiện lại ngay, `header top 0`, `nav bottom 82` |
| Thanh tự ẩn, đầu trang | không bao giờ ẩn khi `scrollY <= 4` |
| Thanh tự ẩn, rung 4px | dưới ngưỡng 8px nên không đổi trạng thái |
| Thanh tự ẩn, menu mở | cuộn xuống khi menu tài khoản đang mở → menu tự đóng |
| Thanh tự ẩn, neo `#post-` | `scroll-padding-top: 82px` → bài nằm ở `top: 82` thay vì bị thanh che |
| Thanh tự ẩn, deep link | mở `/t/...#post-...` → thanh vẫn hiện, chờ cử chỉ thật rồi mới theo dõi |
| Thanh tự ẩn, FAB | `.infinite-stop` vẫn `position: fixed` ở góc phải dưới (`bottom: 64px` desktop / `72px` mobile, 34×34), ẩn khi cuộn xuống, hiện khi cuộn lên |
| Thanh tự ẩn, mobile | 390px: `--header-h` **44.5px**, `--chrome-h` **80.167px**, không tràn ngang |
| Khe giữa hai thanh, desktop | `header.bottom` 46 = `nav.top` 46, `gap: 0`, `border-top: 0px`; cột pixel cắt qua đường nối: **0 hàng lệch màu** `#363d45` |
| Khe giữa hai thanh, mobile | `header.bottom` 44.5 = `nav.top` 44.5, `gap: 0` (trước đây `nav.top` 45 → hở 0.5px); pixel: 0 hàng lệch (trước đây 2 hàng: `#373d43` + `#40474e`) |
| Khe giữa hai thanh, chế độ | sáng và tối đều `gap: 0`, cùng `background: rgb(54,61,69)` cho cả header và nav |
| `--chrome-h` lẻ | `scroll-padding-top: 81.667px` theo đúng biến; `scrollIntoView({block:'start'})` hạ mục tiêu xuống `top: 82` = đúng đáy nav |
| Menu header × nav | 14 phím tắt (nav 2 dòng desktop, 314px mobile): menu tài khoản/hộp thư/thông báo/tìm kiếm không bị nav che, `elementFromPoint` quét từng 4px trong menu đều trả về node của menu |
| Bảng soạn thảo cũ | chưa có thanh nav nào bị cắt: panel overflow 373×45 ở `top 543`, bảng emoji 1009×222 ở `top 369` — đều nằm dưới vùng thanh sticky |
| Sửa album sticker, overlay | `.modal-backdrop` `position: fixed`, `z-index: 1000`, nền `rgba(0,0,0,.5)`; `.modal` rộng **780px** (rộng hơn mặc định 560px), canh giữa (`top 269` trên khung 900px) |
| Sửa album, hai nút mở một hộp thoại | ✏️ (`data-rename`) và 🖼️ (`data-images`) đều mở "Sửa album sticker" |
| Sửa album, kéo thả | kéo ô #1 thả lên ô #3 → `[a1,a2,a3]` → `[a2,a3,a1]`; badge đánh lại 1/2/3; Lưu → localStorage đúng thứ tự mới, `preview` = ảnh đầu mới |
| Sửa album, huỷ | kéo thả đổi thứ tự + sửa tên rồi **Huỷ** → tên và thứ tự lưu vẫn nguyên như trước |
| Sửa album, đổi tên | `"  Pepe Đổi Tên   Mới  "` → lưu `"Pepe Đổi Tên Mới"` (gộp khoảng trắng), hàng trong danh sách cập nhật |
| Sửa album, tên rỗng | để trống + Lưu → hộp thoại vẫn mở, `#album-edit-error` = "Tên album không được để trống.", dữ liệu không đổi |
| Sửa album, đóng | nút `✕` header, nút Huỷ, bấm nền đều đóng |
| Sửa album, tương phản | ô nhập / tiêu đề / gợi ý / badge / hai nút × 2 chế độ → thấp nhất **4.51:1** (tiêu đề ở chế độ sáng), đều đạt AA |
| Sửa album, mobile | 390px: hộp thoại 358px, không tràn ngang, lưới 330px |
| Sửa album, cảm ứng | `@media (hover: none)` có trong CSS đã parse (`conditionText "(hover: none)"` → `.sticker-remove { opacity: 1 }`) |
| Phông thay thế | đổi sang Be Vietnam Pro → 3 tệp woff2 tải xong, `--chrome-h` tự đo lại (47px khi nav rỗng rồi 81px khi phím tắt render), `scroll-padding-top` theo kịp |
| Phông Be Vietnam | `data-font="be-vietnam"`, `--font` = `"Be Vietnam", …`, **4** file woff2 (400/500/700 + italic 400) đều 200 |
| Be Vietnam, chữ Việt | đo bề rộng "Đặng ộ ữ ệ ĩ" bằng `"Be Vietnam"` so với `"Segoe UI"`: khác nhau ở cả 5 ký tự → file thật sự được dùng |
| Be Vietnam, hết giả bold | cả 4 face `loaded`; bề rộng `Fioren Đặng` @32px: 400 = 191.97 → 500 = 194.03 → 700 = 197.43 (trước đây chỉ một face 400 nên 600 và 700 **bằng nhau** = 189.82) |
| Be Vietnam, nghiêng thật | `font-style: italic` load `be-vietnam-italic-400.woff2` (bề rộng 187.42 ≠ 191.97 của upright) — hết nghiêng giả |
| Be Vietnam, bền vững | F5 và điều hướng sang trang khác vẫn giữ phông; script pre-paint đặt `data-font` + `--font` trước lần vẽ đầu |
| Bốn phông chuyển đổi | `roboto` → Roboto, `be-vietnam-pro` → Be Vietnam Pro, `be-vietnam` → Be Vietnam, `system` → gỡ `--font`, không tệp phông nào |
| `system` không tải phông | 0 request tới `assets/fonts/`, `#font-faces` không tồn tại, `document.fonts` rỗng |
| Breadcrumb | màu `#d1d4d6` giống tên tác giả, đọc được trên nền tối |
| Avatar thread | `/l/` (192×192) cho khung 96px, `srcset` thêm `/o/` cho 2x |

Dữ liệu test đã dọn: bài test đã xoá, conversation test đã leave, cảm xúc đã bỏ.

---

## 10. Trình soạn nội dung dùng chung

- `ui/editor.js` cung cấp trình soạn trực quan độc lập và chế độ BBCode cho trả lời, tạo chủ đề, sửa bài, tạo/trả lời DM. Không dùng mã XenForo/Froala. `ui/editorTools.js` quản lý bảng chèn; `lib/editorCodec.js` parse/render/serialize; CSS riêng `css/editor.css`.
- Thanh công cụ icon SVG tự vẽ, một hàng gọn: B/I/Thêm định dạng | liên kết/ảnh/Thêm nội dung | trích dẫn/spoiler trong dòng/emoji/sticker | undo/Thêm công cụ | xem trước bên phải. **Ảnh từ URL** là một nút duy nhất: panel của nó chứa cả ô URL lẫn dải tải ảnh lên pik.vn, nên không có nút *Tải ảnh lên* riêng. Mỗi nút mở bảng chèn đều bấm lần nữa để đóng; menu nổi đóng khi chọn công cụ, nhấn Escape hoặc bấm ra ngoài; giữ vùng chọn khi mở menu. Màu/cỡ/phông chữ, căn đoạn, danh sách, gạch ngang/gạch chân, mã trong dòng và cỡ chữ to nằm trong menu chữ; media/bảng/đường kẻ/spoiler khối/mã nguồn nằm trong menu nội dung; BBCode, redo, xoá định dạng, nháp và hướng dẫn nằm trong menu công cụ, không có footer nháp dài.
- Có B/I/U/S, màu/cỡ/phông chữ, căn đoạn, danh sách số/bullet, URL ảnh/liên kết, **tải ảnh lên pik.vn**, media YouTube/X/TikTok/Reddit/Imgur, quote, spoiler, code, bảng, HR, cỡ chữ to, emoji và danh mục smilie API; undo/redo tối đa 100 trạng thái, xoá định dạng đoạn chọn, xem trước cục bộ. Bảng emoji chỉ dùng danh mục `/voz/smilies` của voz.vn (79 smilie, khớp 79/79 thứ tự với tab Smilies của editor voz.vn), không chèn sẵn emoji Unicode ngoài bộ đó; chọn emoji không đóng bảng để chèn liên tiếp và ảnh hiện ngay trong khung soạn. Ô chọn giới hạn 32px như voz.vn nên smilie nguồn 24px không bị phóng to gây mờ, kèm biến thể `_2x` cho màn hình hi-dpi. Media xem trước hiện liên kết nguồn, không chạy embed ngoài. Các BBCode chưa biết và ảnh có thuộc tính kích thước được giữ nguyên dưới dạng khối không chỉnh sửa; chuyển BBCode để sửa chúng.
- Giữ nguyên ID textarea và giao diện `.value` đồng bộ. Setter riêng cập nhật visual ngay khi handler quote gán `.value`; không cần event input. Đổi chế độ không serialize lại nội dung chưa sửa. Paste văn bản chỉ nhận text; nếu clipboard có mục `image/*` thì ảnh được tải lên pik.vn và chèn `[IMG]` (xem *Tải ảnh lên pik.vn*). Kéo thả chỉ nhận tệp ảnh, HTML không được chèn. URL chỉ HTTP(S) tuyệt đối, không credentials; HTML và thuộc tính luôn escape. Preview là codec cục bộ, không phải kết quả render chính thức của voz.vn.
- Nháp lưu localStorage khi sửa (30 ngày), tách theo tài khoản/đường dẫn/editor và post ID khi sửa bài. Nháp không tự đè nội dung: dùng **Khôi phục nháp**; **Xoá nháp** chỉ xoá bản lưu, không xoá nội dung đang soạn. Gửi/lưu thành công mới xoá nháp. Nháp bao gồm nội dung DM dạng văn bản trên thiết bị: không dùng trên máy chia sẻ nếu không muốn lưu cục bộ. Không lưu tiêu đề/người nhận.
- Không upload lên voz.vn: proxy chỉ xin `attachment:read`; API attachment vẫn lỗi theo `voz-app-api.md` §13.5 dù scope write có thể được cấp. Ảnh tải lên đi qua **pik.vn** (xem mục *Tải ảnh lên pik.vn*); ngoài ra vẫn dùng được URL ảnh hoặc giao diện voz.vn.
- Kiểm tra không mạng: từ thư mục cha chạy `node --test vtesst1\editor-codec.test.mjs vtesst1\editor-toolbar.test.mjs` (codec, URL nguy hiểm, escape, nested BBCode, cấu trúc lossless, serializer). Hiện 10/10 test pass. Kiểm thử tương tác trình duyệt riêng; không gửi bài/DM thật để test. Bộ đầy đủ: `node --test vtesst1/*.test.mjs` (hiện **152/152** pass), gồm `unread.test.mjs` (phân giải bài chưa đọc), `threadRow.test.mjs` (link `/unread`), `subforums.test.mjs` (khối diễn đàn con không tiêu đề), `post-links.test.mjs` (link voz.vn → nội bộ, `/ignore` giữ nguyên), `signature.test.mjs` (chữ ký BBCode → HTML), `font-scale.test.mjs` (chuẩn hoá cỡ chữ, giới hạn 80–200, không còn px trần, script pre-paint), `unfurl.test.mjs` (specificity icon/preview so với `.bbWrapper img:not(.smilie)`, hợp đồng `data-onerror`), `settings-appearance.test.mjs` (sáng/tối/phông + sự tồn tại của mọi file phông), `settings-tabs.test.mjs` (tab theo fragment), `chrome-branding.test.mjs` (logo SVG + câu footer), `chrome-autohide.test.mjs` (hợp đồng sticky/z-index/scroll-padding + không có khe giữa hai thanh) và `theme-tokens.test.mjs` (hợp đồng token giữa hai bảng màu).

## 11. Ghi chú triển khai

- `package.json` có `"type": "module"` — bắt buộc để Vercel hiểu `api/*.js` là ESM.
- Tên file `api/[...path].js` là catch-all của Vercel: mọi `/api/<bất kỳ>` vào cùng một
  function. `api/index.js` chỉ re-export để `/api` (không có sub-path) cũng chạy.
- `vercel.json` khai báo `outputDirectory: "public"`, `regions: ["sin1"]`, SPA rewrite
  `/((?!api/|assets/|userscript/).*)` → `/index.html`, và header
  `Cache-Control: private, no-store, max-age=0` cho `/api/(.*)`.
- `dev-server.mjs` import trực tiếp `api/[...path].js` và dựng `Request`/`Response` chuẩn
  Web API, nên handler chạy y hệt trên Node và trên edge; `Set-Cookie` được chuyển qua
  `getSetCookie()` để không mất nhiều header.
- Không commit `tokens.json` hay bất kỳ file chứa token thật.
- Token trong cookie hết hạn sau `expires_in` (thường 1 giờ); edge tự refresh, nhưng nếu
  refresh token cũng hết hạn thì người dùng phải đăng nhập lại.

### 11.1 Checklist khi sửa code

| Muốn đổi | Sửa ở đâu |
|---|---|
| Thêm route mới | `core/router.js` (`route()`) + tạo `views/<tên>.js` + thêm `*Path()` vào `core/paths.js` nếu cần URL mới |
| Thêm endpoint voz.vn | thêm method vào object `api` trong `api.js`; nếu cần scope mới thì sửa `SCOPES` trong `api/[...path].js` |
| Thêm endpoint riêng của edge | thêm nhánh `if (path === '/api/…')` trong `handler()` của `api/[...path].js` |
| Đổi màu / kích thước | `css/base.css` (`:root` cho bảng sáng, `:root[data-theme="dark"]` cho bảng tối) trước, chỉ thêm rule cục bộ khi thật sự cần. Mọi thành phần phải dùng `var(--token)`, không hardcode màu |
| Đổi bố cục mobile | `css/responsive.css` (breakpoint 900/860/650/620) hoặc `@media` trong file khu vực |
| Thêm BBCode mới | `lib/editorCodec.js` (`inline`/`block` map) + `lib/spoilers.js` nếu là block đặc biệt + `ui/editorTools.js` nếu cần nút |
| Thêm provider media | `frameRules` + `restoreMedia()` trong `lib/media.js`, và nhánh tương ứng trong `editorTools.js`. Provider không có iframe (như Flickr) thì thêm vào `OEMBED_SITES`/`OEMBED_IMAGE_HOSTS` và `OEMBED_TARGETS` trong proxy |
| Đổi cách hiển thị thời gian | `core/utils.js` (`timeAgo` / `postDate` / `fullDate`) |
| Đổi badge chưa đọc | `ui/unreadCounts.js` |
| Đổi nháp editor | `ui/editor.js` (`draftKey`, `save()`, `editor:clear-draft`) |
| Thêm thiết lập mới | `lib/settings.js` (thêm field vào `emptySettings`/`normalizeSettings` + getter/setter + hằng số nhãn) + form trong `views/settings.js`; JSON backup tự động gồm field mới. Có hai nguồn nhãn cần cập nhật nếu thiết lập là giao diện: script inline trong `index.html` và `ui/theme.js` |
| Thêm một `font-size` mới | luôn viết `calc(<px> * var(--ui-scale))`, hoặc `var(--post-scale)` nếu nằm trong `.message-body`. `vtesst1/font-scale.test.mjs` fail khi còn px trần, nên chạy lại bộ test sau khi sửa CSS |
| Thêm một thiết lập cần `--font` | dùng `--font-control` (UI) hoặc `--font-post` (nội dung bài), **không** ghi trực tiếp `--font`: bên trong `.message-body` thì `--font` thắng `--font-post` và nhánh bài viết chết lặng |
| Thêm phông chữ mới | bỏ `.ttf` gốc vào thư mục `--src`, thêm mức vào `WEIGHTS`/`FONT_STACKS`/`FONTS`/`FONT_LABELS`, chạy lại `tools/build-fonts.py`, thêm khối `@font-face` vào `css/fonts.css`, thêm nhánh trong script inline của `index.html` |

### 11.2 Kiểm tra trước khi deploy

```powershell
cd "D:\Data 2\Github-Clone\siritami"
node --test vtesst1\editor-codec.test.mjs vtesst1\editor-toolbar.test.mjs
cd vtest
node dev-server.mjs 3111
# mở http://localhost:3111 — kiểm tra trang chủ, 1 thread, 1 DM, /login
```

`node --check` cho từng file `.js`/`.mjs` cũng hữu ích vì project không có bundler hay
type-checker: `Get-ChildItem -Recurse -Include *.js,*.mjs | ForEach-Object { node --check $_.FullName }`.
