// O parser roda fora da interface e é encerrado após 25 segundos pelo cliente.
function checkDocx(buffer) {
  const v=new DataView(buffer);let total=0,count=0;
  for(let p=Math.max(0,v.byteLength-65557);p<=v.byteLength-22;p++){
    if(v.getUint32(p,true)!==0x06054b50)continue;
    count=v.getUint16(p+10,true);let pos=v.getUint32(p+16,true);
    if(count>2000)throw new Error('DOCX com arquivos internos demais.');
    for(let i=0;i<count;i++){
      if(pos+46>v.byteLength||v.getUint32(pos,true)!==0x02014b50)throw new Error('DOCX inválido.');
      total+=v.getUint32(pos+24,true);if(total>30*1024*1024)throw new Error('DOCX descompactado excede 30 MB.');
      pos+=46+v.getUint16(pos+28,true)+v.getUint16(pos+30,true)+v.getUint16(pos+32,true);
    }
    return;
  }
  throw new Error('Não foi possível ler a estrutura do DOCX.');
}
self.onmessage=async({data:{name,buffer}})=>{
  try{
    const extension=name.split('.').pop().toLowerCase();let text='';
    if(extension==='pdf'){
      const pdfjs=await import('./vendor/pdf.min.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdf.worker.min.mjs',self.location.href).href;
      const task=pdfjs.getDocument({data:new Uint8Array(buffer),isEvalSupported:false,useSystemFonts:true});
      const pdf=await task.promise;
      try{
        if(pdf.numPages>50)throw new Error('Selecione um PDF com até 50 páginas.');
        for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i);const content=await page.getTextContent();text+=`\n[Página ${i}]\n`+content.items.map(x=>('str'in x?x.str+(x.hasEOL?'\n':' '):'')).join('');if(text.length>30000)throw new Error('PDF longo demais. Separe o trecho em um arquivo menor (até 30 mil caracteres).');}
        if(text.replace(/\[Página \d+\]/g,'').trim().length<10)throw new Error('Este PDF não contém texto legível. PDFs escaneados precisam de OCR antes do envio.');
      }finally{await task.destroy();}
    }else if(extension==='docx'){
      checkDocx(buffer);importScripts('./vendor/mammoth.browser.min.js');
      const result=await self.mammoth.extractRawText({arrayBuffer:buffer});text=result.value;
    }else{
      text=new TextDecoder('utf-8',{fatal:true}).decode(buffer);if(text.includes('\0'))throw new Error('Arquivo binário não suportado.');
    }
    if(!text.trim())throw new Error('O arquivo não contém texto legível.');
    if(text.length>30000)throw new Error('O arquivo excede 30 mil caracteres. Envie um trecho menor.');
    self.postMessage({text});
  }catch(error){self.postMessage({error:error?.message||'Não foi possível ler o arquivo.'});}
};
