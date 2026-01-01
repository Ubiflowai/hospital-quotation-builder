import { useState, useEffect, useRef } from 'react';
import { productCatalog } from './data';
import html2pdf from 'html2pdf.js';

export default function Calculator() {
  // --- STATE: DATA ---
  const [rows, setRows] = useState([]); 
  const [categoryOrder, setCategoryOrder] = useState([]); 
  
  // --- STATE: GLOBAL DRIVERS ---
  const [copperRate, setCopperRate] = useState(1270); 
  const [baseMarginPercent, setBaseMarginPercent] = useState(20);
  
  // --- STATE: TOTALS ---
  const [grandTotalCost, setGrandTotalCost] = useState(0);
  const [grandTotalProjectValue, setGrandTotalProjectValue] = useState(0);
  const [grandTotalProfit, setGrandTotalProfit] = useState(0);
  const [gstPercent, setGstPercent] = useState(18);

  // --- STATE: COVER LETTER CONTENT (Editable) ---
  const [coverRef, setCoverRef] = useState("UBS/78PL/MMCK");
  const [coverDate, setCoverDate] = useState("09-12-2025");
  const [coverToName, setCoverToName] = useState("Managing Director");
  const [coverToCompany, setCoverToCompany] = useState("MALABAR MEDICAL CENTRE");
  const [coverToAddress, setCoverToAddress] = useState("KONDOTTY.");
  const [coverSubject, setCoverSubject] = useState("New - MGPS project");
  
  const [coverBody1, setCoverBody1] = useState("This has reference to the discussion we had with you regarding the medical gas Pipe line project. Please see the attached price details for the same.");
  const [coverBody2, setCoverBody2] = useState("We are trained by Beacon Medaes (part of Atlascopco group) India, UK and USA and have AP and NFPA certificates. We follow international standards as applicable to complete our projects.");
  const [coverBody3, setCoverBody3] = useState("After installation, commissioning and training we provide test certificate to put the MGPS system for patient use. We offer you our maximum dedicated service and attention for success of the project.");

  // Terms Content
  const [termTaxes, setTermTaxes] = useState("GST 18% will be Extra as applicable as per Govt norms at the time of billing.");
  const [termSupply, setTermSupply] = useState("The normal completion period is approximately 2-3 months from the date of receipt of technically and commercially confirmed clear order along with advance payment. The completion date may vary due to delay in Civil and electrical works related to MGPS. Delay in manufacturing of goods, delay in delivery resulting from any cause beyond the company’s reasonable control, order/instructions of any govt authority, acts of God or military authority.");
  const [termWarranty, setTermWarranty] = useState("All our installations and supplies would carry a warranty for 12 months from the date of installation.");
  const [termSupport, setTermSupport] = useState("We have trained Service Engineers to give service support for the customers. We will be giving training for the concerned staff. After warranty period, customer can enter in Annual Maintenance Contract with the company. AMC/CMC details attached with Quotation.");
  const [termPayment, setTermPayment] = useState("50% advance and 40% at the time of installation, 10% after installation. All the related Electrical and Civil works should be completed by the hospital authority. A safe room with door should be provided for material storage. The billing will be made on the basis of actual materials used to complete the project.");

  const [signatoryName, setSignatoryName] = useState("Ahammad adil");
  const [signatoryPhone, setSignatoryPhone] = useState("09388774401");

  // --- VIEW STATE ---
  const [isClientMode, setIsClientMode] = useState(false);
  const [activeTab, setActiveTab] = useState('cover'); // 'cover' or 'quote'
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  
  const pdfRef = useRef();
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef(null);

  // --- CALCULATION LOGIC ---
  const calculateRow = (row, overrideMargin = null) => {
    const marginPct = overrideMargin !== null ? overrideMargin : row.marginPercent;
    
    // Costs
    const transAmt = row.factoryPrice * (row.transPercent / 100);
    const internalCost = row.factoryPrice + transAmt + row.fittingCost + row.saddleCost + row.workCost;
    
    // Margin
    const marginAmt = internalCost * (marginPct / 100);
    
    // Quoted Price (Cost + Margin)
    const calculatedPrice = internalCost + marginAmt;
    
    return {
        ...row,
        transAmt,
        internalCost,
        marginPercent: marginPct,
        marginAmt,
        quotedPrice: parseFloat(calculatedPrice.toFixed(2)) 
    };
  };

  // --- HANDLERS ---
  const handleCopperRateChange = (newRate) => {
      const rate = parseFloat(newRate) || 0;
      setCopperRate(rate);
      setRows(rows.map(row => {
          if (row.categoryId === 1000) {
              const catalogItem = productCatalog.find(c => c.id === 1000)?.items.find(i => i.id === row.id);
              if (catalogItem && catalogItem.weight !== undefined) {
                   const newFactoryPrice = catalogItem.weight * rate;
                   return calculateRow({ ...row, factoryPrice: newFactoryPrice }, null);
              }
          }
          return row;
      }));
  };

  const addRow = (productId, categoryId) => {
    const category = productCatalog.find(c => c.id === categoryId);
    const product = category?.items.find(p => p.id === productId);
    if (!product) return;

    if (!categoryOrder.includes(categoryId)) {
        setCategoryOrder([...categoryOrder, categoryId]);
    }

    let startPrice = product.factoryPrice || 0;
    if (product.weight !== undefined) {
        startPrice = product.weight * copperRate;
    }

    const newRowRaw = {
      uid: Date.now(),
      id: product.id,
      categoryId: categoryId,
      name: product.name,
      hsn: "9018",
      unit: product.unit,
      qty: 1,
      factoryPrice: startPrice,
      transPercent: 2,
      fittingCost: 0,
      saddleCost: 0,
      workCost: 0,
      marginPercent: baseMarginPercent,
    };

    setRows([...rows, calculateRow(newRowRaw, baseMarginPercent)]);
    setSearchTerm('');
    setShowDropdown(false);
    setActiveTab('quote');
  };

  const removeRow = (uid) => setRows(rows.filter(r => r.uid !== uid));

  const updateRow = (uid, field, value) => {
    const val = value === '' ? 0 : parseFloat(value);
    setRows(rows.map(row => {
        if (row.uid !== uid) return row;
        const updated = { ...row, [field]: val };

        if (field === 'transAmt') {
             updated.transPercent = row.factoryPrice > 0 ? (val / row.factoryPrice) * 100 : 0;
        } else if (field === 'marginAmt') {
             const cost = row.internalCost;
             updated.marginPercent = cost > 0 ? (val / cost) * 100 : 0;
             updated.quotedPrice = cost + val;
             return { ...updated, marginAmt: val }; 
        } else if (field === 'quotedPrice') {
            const cost = row.internalCost;
            if (cost > 0) {
                const newMarginAmt = val - cost;
                updated.marginAmt = newMarginAmt;
                updated.marginPercent = (newMarginAmt / cost) * 100;
            }
            return updated; 
        }
        return calculateRow(updated, null);
    }));
  };

  const handleRowAmountChange = (uid, newAmount) => {
      const amount = parseFloat(newAmount) || 0;
      setRows(rows.map(row => {
          if (row.uid !== uid) return row;
          const qty = row.qty || 1;
          const newRate = amount / qty;
          const cost = row.internalCost;
          const newMarginAmt = newRate - cost;
          const newMarginPercent = cost > 0 ? (newMarginAmt / cost) * 100 : 0;
          return { ...row, quotedPrice: newRate, marginAmt: newMarginAmt, marginPercent: newMarginPercent };
      }));
  };

  const handleGlobalMarginChange = (newVal) => {
      const margin = parseFloat(newVal) || 0;
      setBaseMarginPercent(margin);
      setRows(rows.map(row => calculateRow(row, margin)));
  };

  const handleGrandTotalChange = (newTotal) => {
      const total = parseFloat(newTotal) || 0;
      if (grandTotalCost <= 0) { setGrandTotalProjectValue(total); return; }
      const newMargin = ((total / grandTotalCost) - 1) * 100;
      setBaseMarginPercent(newMargin);
      setRows(rows.map(row => calculateRow(row, newMargin)));
  };

  const moveCategory = (index, direction) => {
    const newOrder = [...categoryOrder];
    if (direction === 'up' && index > 0) { [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]]; } 
    else if (direction === 'down' && index < newOrder.length - 1) { [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]]; }
    setCategoryOrder(newOrder);
  };

  useEffect(() => {
      let costSum = 0; let valueSum = 0;
      rows.forEach(r => { costSum += r.internalCost * r.qty; valueSum += r.quotedPrice * r.qty; });
      setGrandTotalCost(costSum); setGrandTotalProjectValue(valueSum); setGrandTotalProfit(valueSum - costSum);
  }, [rows]);

  // --- SEARCH ---
  const searchResults = [];
  if (searchTerm.length > 0) {
    productCatalog.forEach(cat => {
        cat.items.forEach(item => {
            if (item.name.toLowerCase().includes(searchTerm.toLowerCase()) || cat.name.toLowerCase().includes(searchTerm.toLowerCase())) {
                searchResults.push({ categoryId: cat.id, categoryName: cat.name, ...item });
            }
        });
    });
  }

  // --- PDF GENERATION (UPDATED FOR MARGINS) ---
  const handleDownloadPDF = () => {
    setIsPdfGenerating(true);
    const wasInClientMode = isClientMode;
    if (!isClientMode) setIsClientMode(true);

    setTimeout(() => {
        const element = pdfRef.current;
        html2pdf().set({ 
            margin: [5, 5, 5, 5], // Updated: Compact margins
            filename: `Quote_${coverRef.replace(/\//g, '-')}.pdf`, 
            html2canvas: { scale: 2, useCORS: true }, 
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['css', 'legacy'] } 
        }).from(element).save().then(() => {
             setIsPdfGenerating(false);
             if (!wasInClientMode) setIsClientMode(false);
        });
    }, 1000);
  };

  // --- STYLES ---
  const inputStyle = { width: '100%', border: '1px solid #cce5ff', background: '#f0f8ff', padding: '2px 4px', borderRadius: '4px', textAlign:'right', fontSize:'11px' };
  const readOnlyStyle = { width: '100%', border: 'none', background: 'transparent', textAlign:'right', color:'#555', fontWeight:'500', fontSize:'11px' };
  const headerStyle = { background: '#343a40', color: 'white', textAlign: 'center', fontSize:'11px', padding:'5px 2px' };
  
  // Editable Textarea Style for Cover Letter
  const editableStyle = {
      width: '100%', border: '1px dashed #ccc', background: 'transparent', 
      fontFamily: 'inherit', fontSize: 'inherit', padding: '2px', resize: 'vertical',
      minHeight: '20px'
  };
  const sectionTitleStyle = { fontSize: '10px', fontWeight: 'bold', textDecoration: 'underline', marginTop: '6px', marginBottom: '2px' };

  // --- UPDATED HEADER (Uses Image) ---
  const DocumentHeader = () => (
    <div style={{ marginBottom: '10px', textAlign: 'center' }}>
      {/* Ensure you put the file 'header.png' in your project's PUBLIC folder */}
      <img 
        src="/header.png" 
        alt="United Biomedical Services" 
        style={{ width: '100%', height: 'auto', maxHeight: '120px', objectFit: 'contain' }} 
      />
    </div>
  );

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px', backgroundColor: '#e9ecef', minWidth: '1100px', paddingBottom:'150px' }}>
      
      {/* --- CONTROL BAR --- */}
      <div style={{ marginBottom: '20px', display: 'flex', flexDirection:'column', gap:'15px', background: 'white', padding: '15px 20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        
        {/* TOP ROW: TITLE & TABS */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #eee', paddingBottom:'10px'}}>
             <h2 style={{ margin: 0, color: '#2c3e50' }}>Quotation Manager</h2>
             
             <div style={{ display:'flex', gap:'10px' }}>
                 <button onClick={() => setActiveTab('cover')} style={{ padding: '10px 20px', cursor: 'pointer', borderRadius: '20px', fontWeight: 'bold', border: 'none', background: activeTab === 'cover' ? '#007bff' : '#e2e6ea', color: activeTab === 'cover' ? 'white' : '#495057', boxShadow: activeTab === 'cover' ? '0 2px 5px rgba(0,123,255,0.4)' : 'none' }}>
                    1. Edit Cover Letter
                 </button>
                 <button onClick={() => setActiveTab('quote')} style={{ padding: '10px 20px', cursor: 'pointer', borderRadius: '20px', fontWeight: 'bold', border: 'none', background: activeTab === 'quote' ? '#007bff' : '#e2e6ea', color: activeTab === 'quote' ? 'white' : '#495057', boxShadow: activeTab === 'quote' ? '0 2px 5px rgba(0,123,255,0.4)' : 'none' }}>
                    2. Edit Quotation
                 </button>
             </div>
        </div>

        {/* BOTTOM ROW: GLOBAL SETTINGS */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
             {!isClientMode ? (
                 <div style={{ display: 'flex', alignItems: 'center', background: '#fff3cd', padding: '5px 15px', borderRadius: '20px', border:'1px solid #ffeeba' }}>
                    <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#856404', marginRight: '10px' }}>Copper Market Rate:</span>
                    <input type="number" value={copperRate} onChange={(e) => handleCopperRateChange(e.target.value)}
                        style={{ width: '80px', padding: '5px', borderRadius: '4px', border: '1px solid #ccc', textAlign: 'center', fontWeight:'bold' }} />
                </div>
             ) : <div></div>}

            <div style={{display:'flex', gap:'10px'}}>
                <button onClick={() => setIsClientMode(!isClientMode)} style={{ padding: '8px 20px', background: isClientMode ? '#28a745' : '#6c757d', color:'white', border: 'none', borderRadius: '4px', cursor:'pointer', fontWeight:'bold' }}>
                    {isClientMode ? "Exit Client Mode" : "Client Mode"}
                </button>
                <button onClick={handleDownloadPDF} style={{ padding: '8px 20px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor:'pointer', fontWeight:'bold' }}>
                    Download PDF
                </button>
            </div>
        </div>
      </div>

      {/* --- SEARCH BAR (Only visible on Quote Tab) --- */}
      {(!isClientMode && activeTab === 'quote') && (
        <div ref={searchRef} style={{ position: 'relative', marginBottom: '20px' }}>
            <input type="text" placeholder="Search Item to Add to Quote..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setShowDropdown(true); }}
                style={{ width: '100%', padding: '15px', borderRadius: '8px', border: '1px solid #ced4da', fontSize: '16px', boxShadow:'0 2px 5px rgba(0,0,0,0.05)' }} />
            {showDropdown && searchResults.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', maxHeight: '400px', overflowY: 'auto', border: '1px solid #ccc', zIndex: 1000, boxShadow: '0 10px 20px rgba(0,0,0,0.15)', borderRadius:'0 0 8px 8px' }}>
                    {searchResults.map((item, idx) => {
                        let displayPrice = item.factoryPrice;
                        if(item.weight !== undefined) displayPrice = item.weight * copperRate;
                        return (
                            <div key={idx} onClick={() => addRow(item.id, item.categoryId)} 
                                style={{ padding: '12px 20px', borderBottom: '1px solid #f1f1f1', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#f8f9fa'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'white'}>
                                <div><span style={{ fontWeight: 'bold', color:'#007bff' }}>{item.categoryName}</span> - {item.name}</div>
                                <div style={{ color: '#666' }}>Base: ₹{displayPrice?.toFixed(0)}</div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
      )}

      {/* ===================================================================================== */}
      {/* PDF DOCUMENT WRAPPER                                                                  */}
      {/* ===================================================================================== */}
      
      <div ref={pdfRef} style={{ background: 'white', width: '210mm', minHeight: '297mm', margin: '0 auto', padding: '10mm', boxShadow: '0 5px 30px rgba(0,0,0,0.1)', boxSizing: 'border-box' }}>
        
        {/* ======================= PAGE 1: COVERING LETTER (COMPACT) ======================= */}
        <div className="page-1" style={{ fontSize: '10pt', lineHeight: '1.2', color: '#000', display: (activeTab === 'cover' || isPdfGenerating) ? 'block' : 'none' }}>
            
            <DocumentHeader />

            {/* Reference Line - Compact */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontWeight: 'bold', fontSize: '10pt' }}>
                <div>Ref: <input value={coverRef} onChange={(e) => setCoverRef(e.target.value)} style={{ border: 'none', fontWeight: 'bold', width: '150px', fontSize: 'inherit' }} /></div>
                <div>Date: <input value={coverDate} onChange={(e) => setCoverDate(e.target.value)} style={{ border: 'none', fontWeight: 'bold', width: '100px', textAlign: 'right', fontSize: 'inherit' }} /></div>
            </div>

            {/* To Section - Compact */}
            <div style={{ marginBottom: '8px' }}>
                <div style={{fontWeight:'bold'}}>TO,</div>
                <input value={coverToName} onChange={(e) => setCoverToName(e.target.value)} style={{ ...editableStyle, fontWeight: 'bold', border:'none', padding:'0' }} />
                <input value={coverToCompany} onChange={(e) => {setCoverToCompany(e.target.value);}} style={{ ...editableStyle, fontWeight: 'bold', border:'none', padding:'0' }} />
                <input value={coverToAddress} onChange={(e) => setCoverToAddress(e.target.value)} style={{ ...editableStyle, border:'none', padding:'0' }} />
            </div>

            <div style={{ marginBottom: '8px' }}>Dear Sir,</div>

            {/* Subject - Compact */}
            <div style={{ marginBottom: '8px', fontWeight: 'bold', textDecoration:'underline' }}>
                SUB: <input value={coverSubject} onChange={(e) => setCoverSubject(e.target.value)} style={{ ...editableStyle, fontWeight: 'bold', width: '85%', display: 'inline-block', border:'none', textDecoration:'underline' }} />
            </div>

            {/* BODY PARAGRAPHS - Removed minHeights to save space */}
            <div style={{ marginBottom: '6px' }}>
                <textarea value={coverBody1} onChange={(e) => setCoverBody1(e.target.value)} style={{ ...editableStyle, minHeight: 'auto', border: 'none', overflow:'hidden' }} rows={2} />
            </div>
            <div style={{ marginBottom: '6px' }}>
                <textarea value={coverBody2} onChange={(e) => setCoverBody2(e.target.value)} style={{ ...editableStyle, minHeight: 'auto', border: 'none', overflow:'hidden' }} rows={2} />
            </div>
            <div style={{ marginBottom: '8px' }}>
                <textarea value={coverBody3} onChange={(e) => setCoverBody3(e.target.value)} style={{ ...editableStyle, minHeight: 'auto', border: 'none', overflow:'hidden' }} rows={2} />
            </div>

            {/* TERMS SECTION - COMPACT LAYOUT (Grid style) */}
            <div style={{ marginTop: '5px', borderTop: '1px solid #000', paddingTop: '5px' }}>
                <div style={{ fontWeight: 'bold', textAlign: 'center', textDecoration: 'underline', marginBottom: '5px', fontSize:'9pt' }}>TERMS AND CONDITIONS</div>
                
                {/* Use a smaller font for terms to ensure fit */}
                <div style={{ fontSize: '9pt', display:'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    
                    {/* Column 1 */}
                    <div>
                        <div style={sectionTitleStyle}>TAXES:</div>
                        <textarea value={termTaxes} onChange={(e) => setTermTaxes(e.target.value)} style={{ ...editableStyle, border: 'none', fontSize:'9pt' }} rows={2} />

                        <div style={sectionTitleStyle}>WARRANTY:</div>
                        <textarea value={termWarranty} onChange={(e) => setTermWarranty(e.target.value)} style={{ ...editableStyle, border: 'none', fontSize:'9pt' }} rows={2} />

                        <div style={sectionTitleStyle}>PAYMENT:</div>
                        <textarea value={termPayment} onChange={(e) => setTermPayment(e.target.value)} style={{ ...editableStyle, border: 'none', fontSize:'9pt' }} rows={4} />
                    </div>

                    {/* Column 2 */}
                    <div>
                        <div style={sectionTitleStyle}>SUPPLY/INSTALLATION:</div>
                        <textarea value={termSupply} onChange={(e) => setTermSupply(e.target.value)} style={{ ...editableStyle, border: 'none', fontSize:'9pt' }} rows={5} />

                        <div style={sectionTitleStyle}>AFTER SALES SUPPORT:</div>
                        <textarea value={termSupport} onChange={(e) => setTermSupport(e.target.value)} style={{ ...editableStyle, border: 'none', fontSize:'9pt' }} rows={3} />
                    </div>
                </div>
            </div>

            {/* Sign Off */}
            <div style={{ marginTop: '10px' }}>
                <div>Yours truly,</div>
                <div style={{ fontWeight: 'bold' }}>For United Biomedical Services,</div>
                <div style={{ marginTop: '20px' }}>
                    <input value={signatoryName} onChange={(e) => setSignatoryName(e.target.value)} style={{ border: 'none', fontWeight: 'bold', display: 'block', fontSize:'11pt' }} />
                    <input value={signatoryPhone} onChange={(e) => setSignatoryPhone(e.target.value)} style={{ border: 'none', display: 'block', fontSize:'10pt' }} />
                </div>
            </div>
        </div> 
        {/* END PAGE 1 */}


        {/* ======================= PAGE BREAK ======================= */}
        {isPdfGenerating && (
            <div className="html2pdf__page-break" style={{ pageBreakBefore: 'always', height: '0' }}></div>
        )}


        {/* ======================= PAGE 2: QUOTATION TABLE ======================= */}
        <div className="page-2" style={{ paddingTop: '10px', display: (activeTab === 'quote' || isPdfGenerating) ? 'block' : 'none' }}>
            
            <DocumentHeader />

            <div style={{ textAlign: 'right', marginBottom: '20px' }}>
                <h2 style={{ margin: '0 0 5px 0', color: '#444' }}>QUOTATION DETAILS</h2>
                <div style={{ fontSize: '12px' }}>Ref: {coverRef}</div>
                <div style={{ fontSize: '12px' }}>Date: {coverDate}</div>
            </div>

            {/* QUOTE TABLE */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                    <tr style={{height:'30px'}}>
                        <th style={{...headerStyle, width:'30px'}}>#</th>
                        <th style={{...headerStyle, textAlign:'left', paddingLeft:'10px'}}>Item Description</th>
                        {!isClientMode && (
                            <>
                                <th style={{...headerStyle, width:'50px', background:'#495057'}}>Fact.</th>
                                <th style={{...headerStyle, width:'40px', background:'#495057'}}>Trn%</th>
                                <th style={{...headerStyle, width:'40px', background:'#495057'}}>Trn.₹</th>
                                <th style={{...headerStyle, width:'40px'}}>Fit</th>
                                <th style={{...headerStyle, width:'40px'}}>Sadl</th>
                                <th style={{...headerStyle, width:'40px'}}>Work</th>
                                <th style={{...headerStyle, width:'50px', background:'#6c757d'}}>Total</th>
                                <th style={{...headerStyle, width:'40px', background:'#adb5bd', color:'black'}}>Mrg%</th>
                                <th style={{...headerStyle, width:'40px', background:'#adb5bd', color:'black'}}>Mrg.₹</th>
                            </>
                        )}
                        <th style={{...headerStyle, width:'40px'}}>Qty</th>
                        <th style={{...headerStyle, width:'40px'}}>Unit</th>
                        <th style={{...headerStyle, width:'70px'}}>Rate</th>
                        <th style={{...headerStyle, width:'80px'}}>Amount</th>
                        {!isClientMode && (
                            <>
                                <th style={{...headerStyle, width:'50px', background:'#198754'}}>Pft.Marg</th>
                                <th style={{...headerStyle, width:'40px', background:'#198754'}}>Pft.%</th>
                                <th style={{...headerStyle, width:'60px', background:'#157347'}}>Gross</th>
                                <th style={{...headerStyle, width:'20px', background:'#fff', color:'red'}}></th>
                            </>
                        )}
                    </tr>
                </thead>
                
                <tbody>
                {categoryOrder.map((catId, catIndex) => {
                    const category = productCatalog.find(c => c.id === catId);
                    const catRows = rows.filter(r => r.categoryId === catId);
                    
                    let subTotalAmt = 0;
                    let subTotalCost = 0;
                    let subTotalGross = 0;

                    catRows.forEach(r => {
                        subTotalAmt += r.quotedPrice * r.qty;
                        subTotalCost += r.internalCost * r.qty;
                        subTotalGross += (r.quotedPrice - r.internalCost) * r.qty;
                    });

                    if (catRows.length === 0 && isClientMode) return null;

                    return (
                        <>
                            <tr key={`cat-${catId}`} style={{ background: '#e9ecef' }}>
                                <td colSpan={isClientMode ? 5 : 18} style={{ padding: '5px 10px', fontWeight: 'bold', color:'#333', borderBottom:'1px solid #dee2e6' }}>
                                    <div style={{display:'flex', justifyContent:'space-between'}}>
                                        <span>{category?.name}</span>
                                        {!isClientMode && (
                                            <div>
                                                <button onClick={() => moveCategory(catIndex, 'up')} style={{cursor:'pointer', border:'none', background:'none'}}>⬆</button>
                                                <button onClick={() => moveCategory(catIndex, 'down')} style={{cursor:'pointer', border:'none', background:'none'}}>⬇</button>
                                            </div>
                                        )}
                                    </div>
                                </td>
                            </tr>

                            {catRows.map((row, index) => {
                                const actualProfit = row.quotedPrice - row.internalCost;
                                const actualProfitPercent = row.internalCost > 0 ? (actualProfit / row.internalCost) * 100 : 0;
                                const totalGross = actualProfit * row.qty;

                                return (
                                    <tr key={row.uid} style={{ borderBottom: '1px solid #f1f1f1' }}>
                                        <td style={{ textAlign: 'center', padding:'4px' }}>{index + 1}</td>
                                        <td style={{ padding:'4px' }}>{row.name}</td>
                                        
                                        {!isClientMode && (
                                            <>
                                                <td style={{padding:'2px'}}><input type="number" value={row.factoryPrice.toFixed(0)} onChange={(e)=>updateRow(row.uid, 'factoryPrice', e.target.value)} style={inputStyle} /></td>
                                                <td style={{padding:'2px'}}><input type="number" value={row.transPercent} onChange={(e)=>updateRow(row.uid, 'transPercent', e.target.value)} style={inputStyle} /></td>
                                                <td style={{padding:'2px'}}><input type="number" value={row.transAmt.toFixed(0)} onChange={(e)=>updateRow(row.uid, 'transAmt', e.target.value)} style={readOnlyStyle} tabIndex="-1" /></td>
                                                <td style={{padding:'2px'}}><input type="number" value={row.fittingCost} onChange={(e)=>updateRow(row.uid, 'fittingCost', e.target.value)} style={inputStyle} /></td>
                                                <td style={{padding:'2px'}}><input type="number" value={row.saddleCost} onChange={(e)=>updateRow(row.uid, 'saddleCost', e.target.value)} style={inputStyle} /></td>
                                                <td style={{padding:'2px'}}><input type="number" value={row.workCost} onChange={(e)=>updateRow(row.uid, 'workCost', e.target.value)} style={inputStyle} /></td>
                                                <td style={{padding:'2px', fontWeight:'bold', color:'#666', textAlign:'right'}}>{row.internalCost.toFixed(0)}</td>
                                                <td style={{padding:'2px'}}><input type="number" value={row.marginPercent.toFixed(1)} onChange={(e)=>updateRow(row.uid, 'marginPercent', e.target.value)} style={{...inputStyle, background:'#fff3cd', border:'1px solid #ffeeba'}} /></td>
                                                <td style={{padding:'2px'}}><input type="number" value={row.marginAmt.toFixed(0)} onChange={(e)=>updateRow(row.uid, 'marginAmt', e.target.value)} style={inputStyle} /></td>
                                            </>
                                        )}

                                        <td style={{padding:'2px'}}>
                                            {isClientMode ? <div style={{textAlign:'center'}}>{row.qty}</div> : <input type="number" value={row.qty} onChange={(e)=>updateRow(row.uid, 'qty', e.target.value)} style={{...inputStyle, textAlign:'center'}} />}
                                        </td>
                                        <td style={{textAlign:'center', color:'#888'}}>{row.unit}</td>
                                        
                                        <td style={{padding:'2px'}}>
                                            {isClientMode ? <div style={{textAlign:'right'}}>{row.quotedPrice.toFixed(2)}</div> : <input type="number" value={row.quotedPrice} onChange={(e)=>updateRow(row.uid, 'quotedPrice', e.target.value)} style={{...inputStyle, fontWeight:'bold', color:'#0056b3'}} />}
                                        </td>
                                        
                                        <td style={{padding:'2px', textAlign:'right', fontWeight:'bold'}}>
                                            {isClientMode ? (row.quotedPrice * row.qty).toLocaleString('en-IN') : <input type="number" value={(row.quotedPrice * row.qty).toFixed(2)} onChange={(e)=>handleRowAmountChange(row.uid, e.target.value)} style={{...readOnlyStyle, color:'#000'}} />}
                                        </td>
                                        
                                        {!isClientMode && (
                                            <>
                                                <td style={{textAlign:'right', paddingRight:'5px', color: actualProfit < 0 ? 'red' : '#198754'}}>{actualProfit.toFixed(0)}</td>
                                                <td style={{textAlign:'right', paddingRight:'5px', color: '#666'}}>{actualProfitPercent.toFixed(1)}%</td>
                                                <td style={{textAlign:'right', paddingRight:'5px', fontWeight:'bold', color: totalGross < 0 ? 'red' : '#157347'}}>{totalGross.toFixed(0)}</td>
                                                <td style={{textAlign:'center'}}><button onClick={()=>removeRow(row.uid)} style={{color:'#dc3545', border:'none', background:'none', cursor:'pointer'}}>×</button></td>
                                            </>
                                        )}
                                    </tr>
                                );
                            })}

                            {!isClientMode && (
                                <tr style={{ background: '#f8f9fa', borderTop: '2px solid #dee2e6' }}>
                                    <td colSpan={2} style={{textAlign:'right', padding:'5px', fontWeight:'bold', color:'#888', fontSize:'10px'}}>SECTION TOTAL:</td>
                                    <td colSpan={7}></td>
                                    <td colSpan={1} style={{textAlign:'right', padding:'5px', fontSize:'11px'}}>Cost: {subTotalCost.toFixed(0)}</td>
                                    <td colSpan={4}></td>
                                    <td style={{textAlign:'right', padding:'5px', fontWeight:'bold'}}>₹{subTotalAmt.toLocaleString('en-IN')}</td>
                                    <td colSpan={2}></td>
                                    <td style={{textAlign:'right', padding:'5px', fontWeight:'bold', color: subTotalGross < 0 ? 'red' : 'green'}}>{subTotalGross.toLocaleString('en-IN')}</td>
                                    <td></td>
                                </tr>
                            )}
                        </>
                    );
                })}
                </tbody>
            </table>

            {/* GRAND TOTALS ON PAGE 2 */}
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ width: '300px', padding:'15px', background:'#f8f9fa', borderRadius:'8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom:'10px' }}>
                        <span style={{color:'#666'}}>Sub Total:</span>
                        <strong>₹{grandTotalProjectValue.toLocaleString('en-IN', {minimumFractionDigits: 2})}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom:'10px', paddingBottom:'10px', borderBottom:'1px solid #ddd' }}>
                        <span style={{color:'#666'}}>GST ({gstPercent}%):</span>
                        <span>₹{(grandTotalProjectValue * (gstPercent/100)).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize:'16px', color: '#0056b3', fontWeight: 'bold' }}>
                        <span>GRAND TOTAL:</span>
                        <span>₹{(grandTotalProjectValue * (1 + gstPercent/100)).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                    </div>
                </div>
            </div>

            <div style={{ marginTop: '30px', borderTop:'1px solid #ccc', paddingTop:'10px' }}>
                <div style={{ fontSize:'10px', color:'#666' }}>
                    <strong>Note:</strong> Prices are valid for 30 days. E&OE.
                </div>
            </div>

        </div> 
        {/* END PAGE 2 */}

      </div>

      {/* FOOTER BAR (INTERNAL CONTROLS) */}
      {!isClientMode && (
        <div style={{ position:'fixed', bottom:0, left:0, right:0, background: '#343a40', color:'white', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow:'0 -2px 10px rgba(0,0,0,0.1)', zIndex: 999 }}>
          <div>
            <div style={{ fontSize: '11px', color: '#adb5bd' }}>INTERNAL COST</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>₹{grandTotalCost.toLocaleString('en-IN', {maximumFractionDigits:0})}</div>
          </div>
          
          <div style={{ textAlign: 'center', display:'flex', gap:'20px', alignItems:'center' }}>
             <div>
                 <div style={{ fontSize: '11px', color: '#adb5bd' }}>AVG MARGIN %</div>
                 <input type="number" value={baseMarginPercent.toFixed(2)} onChange={(e) => handleGlobalMarginChange(e.target.value)}
                    style={{ width: '60px', textAlign: 'center', background:'#495057', color:'white', border:'none', padding:'5px', borderRadius:'4px', fontWeight:'bold' }} />
             </div>
             <div>
                <div style={{ fontSize: '11px', color: '#adb5bd' }}>NET PROFIT</div>
                <div style={{ fontSize: '16px', color: '#28a745', fontWeight:'bold' }}>₹{grandTotalProfit.toLocaleString('en-IN', {maximumFractionDigits:0})}</div>
             </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: '#adb5bd' }}>OVERRIDE TOTAL VALUE</div>
            <input type="number" value={grandTotalProjectValue.toFixed(0)} onChange={(e) => handleGrandTotalChange(e.target.value)}
              style={{ fontSize: '20px', width: '140px', textAlign: 'right', background:'white', color:'black', border:'none', padding:'4px 8px', borderRadius:'4px', fontWeight:'bold' }} />
          </div>
        </div>
      )}

    </div>
  );
}