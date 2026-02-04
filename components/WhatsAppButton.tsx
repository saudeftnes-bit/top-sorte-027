
import React from 'react';
import { WhatsAppIcon } from '../App';

const WhatsAppButton: React.FC = () => {
  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3 pointer-events-none">
      <a
        href="https://wa.me/5527999752623"
        target="_blank"
        rel="noopener noreferrer"
        className="bg-[#25D366] text-white p-4 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all pointer-events-auto flex items-center justify-center border-4 border-white"
        aria-label="Participar via WhatsApp"
      >
        <WhatsAppIcon className="w-8 h-8" />
      </a>
    </div>
  );
};

export default WhatsAppButton;
