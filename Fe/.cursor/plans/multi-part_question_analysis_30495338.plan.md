---
name: Multi-Part Question Analysis
overview: Đặc tả luồng, issues và kế hoạch sessions cho tính năng "Câu hỏi nhiều ý" (Question Group) theo Phương án C (Parent-Child trên QuestionT). Plan đã được chia nhỏ thành 6 phần để dễ review.
todos:
  - id: spec-flows
    content: Đặc tả đầy đủ 11 luồng + issues + update flow
    status: completed
  - id: plan-sessions
    content: Chia session implementation cụ thể
    status: pending
isProject: false
---

# Question Group - Đặc tả luồng & Issues

**Plan đã được chia nhỏ.** Xem [question-group/00-index.md](question-group/00-index.md) để điều hướng.

---

## Cấu trúc mới (6 plan con)

| #   | Plan                   | Link                                                                                   |
| --- | ---------------------- | -------------------------------------------------------------------------------------- |
| 00  | Index (Tổng quan)      | [question-group/00-index.md](question-group/00-index.md)                               |
| 01  | Data Model & Backend   | [question-group/01-data-model-backend.md](question-group/01-data-model-backend.md)     |
| 02  | Editor & List          | [question-group/02-editor-list.md](question-group/02-editor-list.md)                   |
| 03  | Worksheet & Assignment | [question-group/03-worksheet-assignment.md](question-group/03-worksheet-assignment.md) |
| 04  | Practice & Grading     | [question-group/04-practice-grading.md](question-group/04-practice-grading.md)         |
| 05  | Polish & Sessions      | [question-group/05-polish-sessions.md](question-group/05-polish-sessions.md)           |

---

## Thứ tự review đề xuất

1. **01** - Data Model & Backend (nền tảng)
2. **02, 03, 04** - Editor, Worksheet, Practice (có thể review song song)
3. **05** - Polish & Sessions (implementation plan)
