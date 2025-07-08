
import React from 'react';
import { TrashIcon, PlusIcon } from './icons';

interface MatrixEditorProps {
    matrixData: { headers: string[]; rows: string[][] };
    onUpdate: (newData: { headers: string[]; rows: string[][] }) => void;
}

const MatrixEditor: React.FC<MatrixEditorProps> = ({ matrixData, onUpdate }) => {
  const handleHeaderChange = (index: number, value: string) => onUpdate({ ...matrixData, headers: matrixData.headers.map((h, i) => i === index ? value : h) });
  const handleCellChange = (rI: number, cI: number, value: string) => onUpdate({ ...matrixData, rows: matrixData.rows.map((r, i) => i === rI ? r.map((c, j) => j === cI ? value : c) : r) });
  
  const addRow = () => onUpdate({ ...matrixData, rows: [...matrixData.rows, Array(matrixData.headers.length).fill('')] });
  const removeRow = (index: number) => onUpdate({ ...matrixData, rows: matrixData.rows.filter((_, i) => i !== index) });

  const addColumn = () => {
    const newHeader = `列 ${matrixData.headers.length + 1}`;
    onUpdate({
      headers: [...matrixData.headers, newHeader],
      rows: matrixData.rows.map(row => [...row, ''])
    });
  };

  const removeColumn = (index: number) => {
    if (matrixData.headers.length <= 1) return; // Don't remove the last column
    onUpdate({
      headers: matrixData.headers.filter((_, i) => i !== index),
      rows: matrixData.rows.map(row => row.filter((_, i) => i !== index))
    });
  };

  return (
    <div className="overflow-x-auto p-1 bg-slate-50 rounded-md border">
        <table className="w-full text-xs border-collapse">
            <thead>
                <tr className="bg-slate-200">
                    {matrixData.headers.map((h, i) => (
                        <th key={i} className="border border-slate-300 p-0 font-semibold text-slate-700">
                            <div className="flex items-center justify-between gap-1 px-1">
                                <input type="text" value={h} onChange={(e) => handleHeaderChange(i, e.target.value)} className="w-full bg-transparent outline-none text-center font-semibold text-slate-800"/>
                                <button onClick={() => removeColumn(i)} className="text-red-500 hover:text-red-700 opacity-30 hover:opacity-100" title="列を削除"><TrashIcon className="w-3 h-3" /></button>
                            </div>
                        </th>
                    ))}
                    <th className="border border-slate-300 p-1 w-10"></th>
                </tr>
            </thead>
            <tbody>
                {matrixData.rows.map((row, rI) => (
                    <tr key={rI}>
                        {row.map((cell, cI) => (
                            <td key={cI} className="border border-slate-300 p-0">
                                <input type="text" value={cell} onChange={(e) => handleCellChange(rI, cI, e.target.value)} className="w-full bg-white text-slate-900 outline-none p-1 focus:bg-blue-50"/>
                            </td>
                        ))}
                        <td className="border border-slate-300 p-1 text-center">
                            <button onClick={() => removeRow(rI)} className="text-red-500 hover:text-red-700" title="行を削除"><TrashIcon className="w-3 h-3" /></button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      <div className="flex gap-2 mt-2">
        <button onClick={addRow} className="text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded flex items-center gap-1"><PlusIcon className="w-3 h-3"/>行を追加</button>
        <button onClick={addColumn} className="text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded flex items-center gap-1"><PlusIcon className="w-3 h-3"/>列を追加</button>
      </div>
    </div>
  );
};

export default MatrixEditor;