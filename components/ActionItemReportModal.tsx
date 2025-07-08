
import React, { useState, useRef, ChangeEvent, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { ActionItem, ActionItemReport, Attachment, ChartType } from '../types';
import { XIcon, PaperClipIcon, TrashIcon, TableCellsIcon, PresentationChartBarIcon, PlusIcon, UploadIcon } from './icons';
import MatrixEditor from './MatrixEditor';

// --- Chart Components ---
const getCoordinatesForPercent = (percent: number) => {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [x, y];
};

const PieChart: React.FC<{ data: { label: string; value: number }[], title: string }> = ({ data, title }) => {
    const total = data.reduce((sum, d) => sum + d.value, 0);
    if (total === 0) return <div className="flex items-center justify-center h-full text-xs text-slate-500">No data for chart</div>;
    
    let cumulativePercent = 0;
    const colors = ['#4A90E2', '#50E3C2', '#F5A623', '#F8E71C', '#7ED321', '#9013FE', '#BD10E0', '#4A4A4A'];
    
    const slices = data.map((d, i) => {
        const percent = d.value / total;
        const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
        cumulativePercent += percent;
        const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
        const largeArcFlag = percent > 0.5 ? 1 : 0;
        
        const pathData = `M ${startX} ${startY} A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY} L 0 0`;
        return { path: pathData, color: colors[i % colors.length], label: d.label, value: d.value };
    });

    return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-white p-2 border rounded-md">
            <h5 className="font-bold text-sm mb-2">{title}</h5>
            <svg viewBox="-1.2 -1.2 2.4 2.4" className="w-32 h-32 mb-2">
                {slices.map((slice, i) => <path key={i} d={slice.path} fill={slice.color} />)}
            </svg>
            <div className="text-[10px] space-y-0.5 w-full">
                {slices.map((slice, i) => (
                    <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center"><span className="w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: slice.color }}></span><span>{slice.label}</span></div>
                        <span>{slice.value} ({((slice.value/total)*100).toFixed(1)}%)</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const LineChart: React.FC<{ data: { label: string; value: number }[], title: string }> = ({ data, title }) => {
    if (data.length < 2) return <div className="flex items-center justify-center h-full text-xs text-slate-500">Need at least 2 data points for a line chart.</div>;
    const maxValue = Math.max(...data.map(d => d.value), 0);
    return (
        <div className="w-full h-full bg-white p-2 border rounded-md">
            <h5 className="text-center font-bold text-sm mb-2">{title}</h5>
            <svg viewBox="0 0 100 50" className="w-full h-40">
                {/* Y-axis lines */}
                {[0, 0.25, 0.5, 0.75, 1].map(f => <line key={f} x1="0" y1={50 - f*45} x2="100" y2={50-f*45} stroke="#f0f0f0" strokeWidth="0.5"/>)}
                {/* Data line */}
                <polyline fill="none" stroke="#4a90e2" strokeWidth="1" points={data.map((d, i) => `${(i / (data.length - 1)) * 100},${50 - (d.value / maxValue) * 45}`).join(' ')} />
                {/* Data points */}
                {data.map((d, i) => <circle key={i} cx={`${(i / (data.length - 1)) * 100}`} cy={`${50 - (d.value / maxValue) * 45}`} r="1.5" fill="#4a90e2" />)}
            </svg>
        </div>
    );
};


const BarChart: React.FC<{ data: { label: string; value: number }[], title: string }> = ({ data, title }) => {
    const maxValue = Math.max(...data.map(d => d.value), 0);
    if(maxValue === 0) return <div className="flex items-center justify-center h-full text-xs text-slate-500">No data for chart</div>;
    return (<div className="w-full h-full bg-white p-2 border rounded-md">
        <h5 className="text-center font-bold text-sm mb-2">{title}</h5>
        <div className="space-y-1">{data.map(d => (<div key={d.label} className="flex items-center text-xs">
            <div className="w-24 truncate pr-2 text-right text-slate-600">{d.label}</div>
            <div className="flex-grow bg-slate-200 rounded-full h-4">
                <div className="bg-blue-500 h-4 rounded-full text-white text-right pr-1" style={{ width: `${(d.value / maxValue) * 100}%` }}>
                    <span className="text-[10px]">{d.value}</span>
                </div>
            </div>
        </div>))}</div>
    </div>);
};
// --- End Chart Components ---

interface ActionItemReportModalProps {
  actionItem: ActionItem;
  onSave: (updatedItem: ActionItem) => void;
  onClose: () => void;
  generateUniqueId: (prefix: string) => string;
}

const ActionItemReportModal: React.FC<ActionItemReportModalProps> = ({ actionItem, onSave, onClose, generateUniqueId }) => {
  const [report, setReport] = useState<ActionItemReport>(actionItem.report || { notes: '', attachments: [], matrixData: null });
  const [chartType, setChartType] = useState<ChartType>('bar');
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  
  const updateReport = (updates: Partial<ActionItemReport>) => {
    setReport(prev => ({...prev, ...updates}));
  };

  const handleSave = () => {
    onSave({ ...actionItem, report });
  };
  
  const handleAttachmentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const MAX_FILE_SIZE_MB = 5;
    const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
    
    if (file.size > MAX_FILE_SIZE_BYTES) {
        alert(`ファイルサイズが大きすぎます。${MAX_FILE_SIZE_MB}MB未満のファイルを選択してください。`);
        if (event.target) event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        if (typeof e.target?.result === 'string') {
            const newAttachment: Attachment = {
                id: generateUniqueId('attach'),
                name: file.name,
                type: file.type,
                dataUrl: e.target.result,
            };
            updateReport({ attachments: [...(report.attachments || []), newAttachment]});
        } else {
            alert('ファイルの読み込みに失敗しました。');
        }
    };
    reader.onerror = () => {
        alert('ファイルの読み込み中にエラーが発生しました。');
    };
    reader.readAsDataURL(file);
    if (event.target) event.target.value = '';
  };

  const handleRemoveAttachment = (id: string) => {
    updateReport({ attachments: report.attachments?.filter(a => a.id !== id)});
  }
  
  const handleExcelImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            if (!Array.isArray(jsonData) || jsonData.length === 0) {
                alert("Excelファイルが空か、有効なデータが含まれていません。");
                if(event.target) event.target.value = '';
                return;
            }

            const headerRow = jsonData[0];
            if (!Array.isArray(headerRow)) {
                alert("Excelファイルのヘッダー行が読み取れませんでした。");
                if(event.target) event.target.value = '';
                return;
            }
            const headers: string[] = headerRow.map(String);

            const rowsData = jsonData.slice(1);
            const rows: string[][] = [];
            for (const rowArray of rowsData) {
              if (Array.isArray(rowArray)) {
                  const newRow = Array(headers.length).fill('');
                  for (let i = 0; i < headers.length; i++) {
                      newRow[i] = rowArray[i] !== null && rowArray[i] !== undefined ? String(rowArray[i]) : '';
                  }
                  rows.push(newRow);
              }
            }
            
            updateReport({ matrixData: { headers, rows }});
        } catch (error) {
            console.error("Error parsing Excel file:", error);
            alert(`Excelファイルの解析中にエラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
          if(event.target) event.target.value = '';
        }
    };
    reader.readAsArrayBuffer(file);
  };


  const chartData = (report.matrixData?.rows || [])
    .map(row => ({ label: row[0], value: parseFloat(row[1]) || 0 }))
    .filter(d => d.label && !isNaN(d.value));

  const renderChart = () => {
    if (!report.matrixData || chartData.length === 0) return null;
    switch(chartType) {
        case 'line': return <LineChart data={chartData} title="データチャート" />;
        case 'pie': return <PieChart data={chartData} title="データチャート" />;
        case 'bar':
        default:
            return <BarChart data={chartData} title="データチャート" />;
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <header className="flex items-center justify-between p-5 border-b border-slate-200">
          <div>
            <h3 className="text-xl font-bold text-slate-800">実施レポート</h3>
            <p className="text-sm text-slate-500">{actionItem.text}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100"><XIcon className="w-6 h-6 text-slate-500" /></button>
        </header>
        
        <div className="flex-grow p-5 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-slate-700">実施内容・メモ</label>
              <textarea value={report.notes} onChange={e => updateReport({ notes: e.target.value })} 
                        className="w-full mt-1 p-2 border rounded-md h-32 bg-slate-50 focus:bg-white text-slate-800" placeholder="実施した内容、結果、考察などを記録..."/>
            </div>
            <div>
                <h4 className="text-sm font-semibold text-slate-700 flex justify-between items-center mb-2">
                    添付ファイル
                    <button onClick={() => attachmentInputRef.current?.click()} className="p-1 hover:bg-slate-200 rounded-full"><PaperClipIcon className="w-5 h-5"/></button>
                    <input type="file" ref={attachmentInputRef} onChange={handleAttachmentChange} className="hidden" multiple={false} />
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto border p-2 rounded-md bg-slate-50">
                    {(report.attachments || []).map(att => (
                        <div key={att.id} className="relative group border rounded-md overflow-hidden bg-white shadow-sm h-24">
                            <a href={att.dataUrl} download={att.name} className="block w-full h-full" aria-label={`Download ${att.name}`}>
                                {att.type.startsWith('image/') ? (
                                    <img src={att.dataUrl} alt={att.name} className="w-full h-full object-cover"/>
                                ) : (
                                    <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center p-2 hover:bg-slate-200">
                                      <PaperClipIcon className="w-8 h-8 text-slate-500"/>
                                    </div>
                                )}
                            </a>
                            <div className="absolute bottom-0 w-full bg-black bg-opacity-60 p-1 pointer-events-none">
                               <p className="text-white text-[10px] truncate" title={att.name}>{att.name}</p>
                            </div>
                            <button onClick={() => handleRemoveAttachment(att.id)} className="absolute top-1 right-1 bg-black bg-opacity-50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                <TrashIcon className="w-3 h-3"/>
                            </button>
                        </div>
                    ))}
                </div>
            </div>
          </div>
          <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-700 flex justify-between items-center">
                  データ・マトリクス
                  <div className="flex items-center gap-2">
                     <button onClick={() => excelInputRef.current?.click()} className="p-1 hover:bg-slate-200 rounded-full" title="Excelからインポート">
                        <UploadIcon className="w-5 h-5 text-green-600"/>
                      </button>
                      <input type="file" ref={excelInputRef} onChange={handleExcelImport} className="hidden" accept=".xlsx, .xls, .csv"/>
                      {report.matrixData && chartData.length > 0 && 
                        <div className="flex items-center gap-1 rounded-full bg-slate-200 p-0.5">
                            <button onClick={() => setChartType('bar')} className={`px-2 py-0.5 rounded-full text-xs ${chartType === 'bar' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-600'}`}>Bar</button>
                            <button onClick={() => setChartType('line')} className={`px-2 py-0.5 rounded-full text-xs ${chartType === 'line' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-600'}`}>Line</button>
                            <button onClick={() => setChartType('pie')} className={`px-2 py-0.5 rounded-full text-xs ${chartType === 'pie' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-600'}`}>Pie</button>
                        </div>
                      }
                      <button onClick={() => updateReport({ matrixData: report.matrixData ? null : {headers: ['項目', '値'], rows: [['', '']]}})} 
                              className="p-1 hover:bg-slate-200 rounded-full" title={report.matrixData ? "マトリクスを削除" : "マトリクスを追加"}>
                        {report.matrixData ? <TrashIcon className="w-5 h-5 text-red-500"/> : <TableCellsIcon className="w-5 h-5"/>}
                      </button>
                  </div>
              </h4>
              {report.matrixData ? <MatrixEditor matrixData={report.matrixData} onUpdate={d => updateReport({ matrixData: d })} /> : null }
              <div className="mt-4">{renderChart()}</div>
          </div>
        </div>

        <footer className="p-5 bg-slate-100 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md shadow-sm hover:bg-slate-50">キャンセル</button>
          <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-700">保存して閉じる</button>
        </footer>
      </div>
    </div>
  );
};

export default ActionItemReportModal;
