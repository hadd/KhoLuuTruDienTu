import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'

import type { AdminDashboardEmployeeKpiT } from '../types'

export type ExportKpiExcelFiltersT = {
  groupName?: string
  roleName?: string
  searchQuery?: string
  statusFilter?: string
}

export async function exportEmployeeKpiToExcel(
  data: Array<AdminDashboardEmployeeKpiT>,
  filters?: ExportKpiExcelFiltersT,
) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'FSI Big Data Platform'
  workbook.lastModifiedBy = 'FSI Admin Dashboard'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('KPI Nhân Sự')

  // Bật đường lưới ô
  sheet.views = [{ showGridLines: true }]

  // 1. Tiêu đề chính
  sheet.mergeCells('A1:T1')
  const titleCell = sheet.getCell('A1')
  titleCell.value = 'BÁO CÁO ĐÁNH GIÁ HIỆU SUẤT KPI NHÂN SỰ'
  titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF1E3A8A' } }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getRow(1).height = 32

  // 2. Thông tin phụ & Bộ lọc
  sheet.mergeCells('A2:T2')
  const metaCell = sheet.getCell('A2')
  const nowStr = new Date().toLocaleString('vi-VN')
  const filterSummary: Array<string> = []
  if (filters?.groupName && filters.groupName !== 'all') {
    filterSummary.push(`Tổ/Nhóm: ${filters.groupName}`)
  }
  if (filters?.roleName && filters.roleName !== 'all') {
    filterSummary.push(`Vai trò: ${filters.roleName}`)
  }
  if (filters?.statusFilter && filters.statusFilter !== 'all') {
    filterSummary.push(`Mức KPI: ${filters.statusFilter}`)
  }
  if (filters?.searchQuery) {
    filterSummary.push(`Từ khóa: "${filters.searchQuery}"`)
  }
  const filterText = filterSummary.length > 0 ? ` | Bộ lọc áp dụng: ${filterSummary.join(', ')}` : ''

  metaCell.value = `Thời gian xuất: ${nowStr}${filterText}`
  metaCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF475569' } }
  metaCell.alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getRow(2).height = 20

  // Dòng trống cách
  sheet.getRow(3).height = 10

  // 3. Cấu hình cột
  const columns = [
    { key: 'stt', header: 'STT', width: 6 },
    { key: 'fullName', header: 'Họ và tên', width: 26 },
    { key: 'role', header: 'Vai trò', width: 16 },
    { key: 'groupName', header: 'Tổ / Nhóm', width: 22 },
    // Maker (Biên tập)
    { key: 'makerCompletedDossiers', header: 'Số HS hoàn thành', width: 18 },
    { key: 'makerAssignedDossiers', header: 'Số HS phân công', width: 18 },
    { key: 'makerDossierRate', header: 'Tỷ lệ HS (%)', width: 14 },
    { key: 'makerCompletedPages', header: 'Số trang hoàn thành', width: 20 },
    { key: 'makerAssignedPages', header: 'Số trang phân công', width: 20 },
    { key: 'makerPageRate', header: 'Tỷ lệ trang (%)', width: 14 },
    // QC (Duyệt)
    { key: 'qcCompletedDossiers', header: 'Số HS hoàn thành', width: 18 },
    { key: 'qcAssignedDossiers', header: 'Số HS phân công', width: 18 },
    { key: 'qcDossierRate', header: 'Tỷ lệ HS (%)', width: 14 },
    { key: 'qcCompletedPages', header: 'Số trang hoàn thành', width: 20 },
    { key: 'qcAssignedPages', header: 'Số trang phân công', width: 20 },
    { key: 'qcPageRate', header: 'Tỷ lệ trang (%)', width: 14 },
    // Summary
    { key: 'avgProcessingTimeMinutes', header: 'Thời gian TB (phút)', width: 20 },
    { key: 'rejectedDossiersCount', header: 'Số lượt bị trả về', width: 18 },
    { key: 'accuracyRate', header: 'Tỷ lệ chính xác KPI (%)', width: 22 },
    { key: 'kpiStatus', header: 'Đánh giá KPI', width: 16 },
  ]

  sheet.columns = columns.map((col) => ({ key: col.key, width: col.width }))

  // Ghép ô cho Tiêu đề Header nhóm (Row 4 & Row 5)
  sheet.mergeCells('A4:A5')
  sheet.getCell('A4').value = 'STT'

  sheet.mergeCells('B4:B5')
  sheet.getCell('B4').value = 'Họ và tên'

  sheet.mergeCells('C4:C5')
  sheet.getCell('C4').value = 'Vai trò'

  sheet.mergeCells('D4:D5')
  sheet.getCell('D4').value = 'Tổ / Nhóm'

  sheet.mergeCells('E4:J4')
  sheet.getCell('E4').value = 'HỒ SƠ BIÊN TẬP'

  sheet.getCell('E5').value = 'HS hoàn thành'
  sheet.getCell('F5').value = 'HS phân công'
  sheet.getCell('G5').value = 'Tỷ lệ HS'
  sheet.getCell('H5').value = 'Trang hoàn thành'
  sheet.getCell('I5').value = 'Trang phân công'
  sheet.getCell('J5').value = 'Tỷ lệ trang'

  sheet.mergeCells('K4:P4')
  sheet.getCell('K4').value = 'HỒ SƠ DUYỆT'

  sheet.getCell('K5').value = 'HS hoàn thành'
  sheet.getCell('L5').value = 'HS phân công'
  sheet.getCell('M5').value = 'Tỷ lệ HS'
  sheet.getCell('N5').value = 'Trang hoàn thành'
  sheet.getCell('O5').value = 'Trang phân công'
  sheet.getCell('P5').value = 'Tỷ lệ trang'

  sheet.mergeCells('Q4:Q5')
  sheet.getCell('Q4').value = 'Thời gian TB (phút)'

  sheet.mergeCells('R4:R5')
  sheet.getCell('R4').value = 'Số lượt bị trả về'

  sheet.mergeCells('S4:S5')
  sheet.getCell('S4').value = 'Độ chính xác KPI'

  sheet.mergeCells('T4:T5')
  sheet.getCell('T4').value = 'Đánh giá KPI'

  // Style Header Rows (4 & 5)
  const headerFillGeneral: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' },
  }
  const headerFillMaker: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E40AF' },
  }
  const headerFillQc: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF3730A3' },
  }

  const thinBorder: ExcelJS.Borders = {
    top: { style: 'thin', color: { argb: 'FF94A3B8' } },
    left: { style: 'thin', color: { argb: 'FF94A3B8' } },
    bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
    right: { style: 'thin', color: { argb: 'FF94A3B8' } },
  }

  for (let r = 4; r <= 5; r++) {
    const row = sheet.getRow(r)
    row.height = 24
    for (let c = 1; c <= 20; c++) {
      const cell = row.getCell(c)
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      cell.border = thinBorder

      if (c >= 5 && c <= 10) {
        cell.fill = headerFillMaker
      } else if (c >= 11 && c <= 16) {
        cell.fill = headerFillQc
      } else {
        cell.fill = headerFillGeneral
      }
    }
  }

  // 4. Đổ dữ liệu hàng
  data.forEach((item, index) => {
    const makerCompletedDossiers = item.makerCompletedDossiersCount ?? (item.role === 'editor' ? item.completedDossiersCount : 0)
    const makerAssignedDossiers = item.makerAssignedDossiersCount ?? (item.role === 'editor' ? item.assignedDossiersCount : 0)
    const makerDossierRate = item.makerDossierCompletionRate ?? (item.role === 'editor' ? item.dossierCompletionRate : 0)
    const makerCompletedPages = item.makerCompletedPagesCount ?? (item.role === 'editor' ? item.completedPagesCount : 0)
    const makerAssignedPages = item.makerAssignedPagesCount ?? (item.role === 'editor' ? item.assignedPagesCount : 0)
    const makerPageRate = item.makerPageCompletionRate ?? (item.role === 'editor' ? item.pageCompletionRate : 0)

    const qcCompletedDossiers = item.qcCompletedDossiersCount ?? (item.role === 'qc' ? item.completedDossiersCount : 0)
    const qcAssignedDossiers = item.qcAssignedDossiersCount ?? (item.role === 'qc' ? item.assignedDossiersCount : 0)
    const qcDossierRate = item.qcDossierCompletionRate ?? (item.role === 'qc' ? item.dossierCompletionRate : 0)
    const qcCompletedPages = item.qcCompletedPagesCount ?? (item.role === 'qc' ? item.completedPagesCount : 0)
    const qcAssignedPages = item.qcAssignedPagesCount ?? (item.role === 'qc' ? item.assignedPagesCount : 0)
    const qcPageRate = item.qcPageCompletionRate ?? (item.role === 'qc' ? item.pageCompletionRate : 0)

    let kpiLabel = 'Đạt'
    let statusFgColor = 'FFD97706' // amber
    let statusBgColor = 'FFFEF3C7'

    if (item.accuracyRate >= 95) {
      kpiLabel = 'Xuất sắc'
      statusFgColor = 'FF047857' // emerald
      statusBgColor = 'FFD1FAE5'
    } else if (item.accuracyRate < 80) {
      kpiLabel = 'Cần cải thiện'
      statusFgColor = 'FFB91C1C' // rose
      statusBgColor = 'FFFEE2E2'
    }

    const row = sheet.addRow([
      index + 1,
      item.fullName,
      item.role,
      item.groupName ?? 'Chưa gán nhóm',
      makerCompletedDossiers,
      makerAssignedDossiers,
      makerDossierRate / 100,
      makerCompletedPages,
      makerAssignedPages,
      makerPageRate / 100,
      qcCompletedDossiers,
      qcAssignedDossiers,
      qcDossierRate / 100,
      qcCompletedPages,
      qcAssignedPages,
      qcPageRate / 100,
      item.avgProcessingTimeMinutes ?? 0,
      item.rejectedDossiersCount ?? 0,
      item.accuracyRate / 100,
      kpiLabel,
    ])

    row.height = 22

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = thinBorder
      cell.font = { name: 'Calibri', size: 10 }

      if (colNumber === 1 || colNumber === 3) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
      } else if (colNumber === 2 || colNumber === 4) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' }
      } else if ([7, 10, 13, 16, 19].includes(colNumber)) {
        // Định dạng phần trăm
        cell.alignment = { horizontal: 'right', vertical: 'middle' }
        cell.numFmt = '0.0%'
      } else if ([5, 6, 8, 9, 11, 12, 14, 15, 17, 18].includes(colNumber)) {
        // Định dạng số nguyên
        cell.alignment = { horizontal: 'right', vertical: 'middle' }
        cell.numFmt = '#,##0'
      } else if (colNumber === 20) {
        // Đánh giá KPI badge style
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: statusFgColor } }
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: statusBgColor },
        }
      }
    })
  })

  // 5. Xuất file
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const dateSuffix = new Date().toISOString().slice(0, 10)
  saveAs(blob, `Bao_Cao_KPI_Nhan_Su_${dateSuffix}.xlsx`)
}
