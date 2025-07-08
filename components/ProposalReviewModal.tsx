
import React, { useState } from 'react';
import { SubStep } from '../types';
import { XIcon } from './icons';

interface Proposal {
  title: string;
  description: string;
}

interface ProposalReviewModalProps {
  proposals: Proposal[];
  existingSubSteps: SubStep[];
  onConfirm: (additions: { newSubSteps: Proposal[], newActionItems: { targetSubStepId: string, title: string }[] }) => void;
  onClose: () => void;
}

const ProposalReviewModal: React.FC<ProposalReviewModalProps> = ({ proposals, existingSubSteps, onConfirm, onClose }) => {
  const [selections, setSelections] = useState<Record<number, { decision: 'NEW' | 'ADD' | 'IGNORE', targetSubStepId?: string }>>(() => {
    const initial: Record<number, any> = {};
    proposals.forEach((_, index) => {
      initial[index] = { decision: 'NEW', targetSubStepId: undefined };
    });
    return initial;
  });

  const handleSelectionChange = (index: number, key: 'decision' | 'targetSubStepId', value: string) => {
    setSelections(prev => ({
      ...prev,
      [index]: { ...prev[index], [key]: value },
    }));
  };

  const handleConfirm = () => {
    const newSubSteps: Proposal[] = [];
    const newActionItems: { targetSubStepId: string, title: string }[] = [];

    Object.entries(selections).forEach(([indexStr, selection]) => {
      const index = parseInt(indexStr, 10);
      const proposal = proposals[index];

      if (selection.decision === 'NEW') {
        newSubSteps.push(proposal);
      } else if (selection.decision === 'ADD' && selection.targetSubStepId) {
        newActionItems.push({ targetSubStepId: selection.targetSubStepId, title: proposal.title });
      }
    });

    onConfirm({ newSubSteps, newActionItems });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <header className="flex items-center justify-between p-5 border-b border-slate-200">
          <h3 className="text-xl font-bold text-slate-800">AIによる計画提案のレビュー</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100"><XIcon className="w-6 h-6 text-slate-500" /></button>
        </header>
        
        <div className="flex-grow p-5 overflow-y-auto space-y-4">
            <p className="text-sm text-slate-600">AIが以下のステップを提案しました。計画に追加する項目と方法を選択してください。</p>
            <div className="space-y-3">
                {proposals.map((p, index) => (
                    <div key={index} className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <p className="font-semibold text-slate-800">{p.title}</p>
                        <p className="text-sm text-slate-600 mb-3">{p.description}</p>
                        <div className="flex items-center gap-4">
                            <select value={selections[index].decision} onChange={e => handleSelectionChange(index, 'decision', e.target.value)}
                                    className="p-2 border border-slate-300 rounded-md text-sm">
                                <option value="NEW">新しいサブステップとして追加</option>
                                {existingSubSteps.length > 0 && <option value="ADD">既存のサブステップに追加</option>}
                                <option value="IGNORE">無視する</option>
                            </select>

                            {selections[index].decision === 'ADD' && (
                                <select value={selections[index].targetSubStepId || ''} onChange={e => handleSelectionChange(index, 'targetSubStepId', e.target.value)}
                                        className="flex-grow p-2 border border-slate-300 rounded-md text-sm">
                                    <option value="" disabled>追加先のサブステップを選択...</option>
                                    {existingSubSteps.map(ss => (
                                        <option key={ss.id} value={ss.id}>{ss.text}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>

        <footer className="p-5 bg-slate-100 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md shadow-sm hover:bg-slate-50">キャンセル</button>
          <button onClick={handleConfirm} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-700">選択を計画に反映</button>
        </footer>
      </div>
    </div>
  );
};

export default ProposalReviewModal;