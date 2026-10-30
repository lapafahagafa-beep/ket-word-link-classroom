# KET 词汇连线课堂

完整练习网页运行在 GitHub Pages，Supabase Edge Function 负责判分，Postgres 保存成绩；不再跳转到 chatgpt.site。

28 个单元，基础/核心分开，姓名进入，首次连线锁定，答对彩带，错词复习，共享排行榜。姓名不能验证身份，无法完全阻止冒名或换名。

前端文件：index.html、app.js、style.css、atlas.webp。源代码在 src/；后端在 supabase/functions/ket-classroom/。前端仅使用公开 publishable key，记录表启用 RLS 并禁止匿名直接读写，服务器通过会话验证后操作。

成绩需要联网保存，使用相同姓名可以在不同设备续做。离线单机版记录不会自动导入。老师可在 Supabase 的 Table Editor 查看 ket_students 和 ket_attempts，导出数据。

Supabase Free 项目可能因长时间不活跃而暂停，需要在控制台恢复。
