import { useState, useEffect, useRef } from 'react';
import { productCatalog } from './data';
import html2pdf from 'html2pdf.js';

export default function Calculator() {
  // --- STATE: DATA ---
  const [rows, setRows] = useState([]); 
  const [categoryOrder, setCategoryOrder] = useState([]); 
  
  // --- STATE: GLOBAL DRIVERS ---
  const [copperRate, setCopperRate] = useState(1270); // Default Copper Rate
  const [baseMarginPercent, setBaseMarginPercent] = useState(20);
  
  // --- STATE: TOTALS ---
  const [grandTotalCost, setGrandTotalCost] = useState(0);
  const [grandTotalProjectValue, setGrandTotalProjectValue] = useState(0);
  const [grandTotalProfit, setGrandTotalProfit] = useState(0);
  const [gstPercent, setGstPercent] = useState(18);

  // --- STATE: VISUALS & STYLES ---
  const [logoUrl, setLogoUrl] = useState(null); 
  const [bodyFontSize, setBodyFontSize] = useState(10); 
  const [bodyColor, setBodyColor] = useState("#000000"); 
  const [isBodyBold, setIsBodyBold] = useState(false); 

  // --- STATE: COVER LETTER CONTENT ---
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
  const [activeTab, setActiveTab] = useState('cover'); 
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  
  const pdfRef = useRef();
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef(null);

  // --- HANDLER: IMAGE UPLOAD ---
  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setLogoUrl(url);
    }
  };

  // ====================================================================
  //  CORE CALCULATION LOGIC 
  // ====================================================================
  
  // 1. Calculate a single row based on its Base Price, Costs, and Margin
  const calculateRow = (row, overrideMargin = null) => {
    const marginPct = overrideMargin !== null ? overrideMargin : row.marginPercent;
    
    // Costs Calculation
    const transAmt = row.factoryPrice * (row.transPercent / 100);
    const internalCost = row.factoryPrice + transAmt + row.fittingCost + row.saddleCost + row.workCost;
    
    // Margin Calculation
    const marginAmt = internalCost * (marginPct / 100);
    
    // Final Quoted Price
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

  // 2. Handle changes to the Copper Market Rate
  //    This specifically targets items in Category 1000 that have a 'weight'
  const handleCopperRateChange = (newRate) => {
      const rate = parseFloat(newRate) || 0;
      setCopperRate(rate);
      setRows(rows.map(row => {
          // Only update Category 1000 (Copper Pipes)
          if (row.categoryId === 1000) {
              const category = productCatalog.find(c => c.id === 1000);
              const catalogItem = category?.items.find(i => i.id === row.id);
              
              // If the item has a weight (like pipes), recalculate Factory Price
              if (catalogItem && catalogItem.weight !== undefined) {
                   const newFactoryPrice = catalogItem.weight * rate;
                   return calculateRow({ ...row, factoryPrice: newFactoryPrice }, null);
              }
              // If it's a fixed price item (like '12mm conseal'), do not change it
          }
          return row;
      }));
  };

  // 3. Add a new row from the Product Catalog
  const addRow = (productId, categoryId) => {
    const category = productCatalog.find(c => c.id === categoryId);
    const product = category?.items.find(p => p.id === productId);
    if (!product) return;

    if (!categoryOrder.includes(categoryId)) {
        setCategoryOrder([...categoryOrder, categoryId]);
    }

    // Determine Base Price:
    // If it has weight, price = weight * copperRate
    // If no weight, price = factoryPrice (Fixed)
    let startPrice = 0;
    if (product.weight !== undefined) {
        startPrice = product.weight * copperRate;
    } else if (product.factoryPrice !== undefined) {
        startPrice = product.factoryPrice;
    }

    const newRowRaw = {
      uid: Date.now(), // Unique ID for React Key
      id: product.id,
      categoryId: categoryId,
      name: product.name,
      hsn: "9018",
      unit: product.unit,
      qty: 1,
      factoryPrice: startPrice,
      transPercent: 2, // Default Transport %
      fittingCost: 0,
      saddleCost: 0,
      workCost: 0,
      marginPercent: baseMarginPercent,
    };

    setRows([...rows, calculateRow(newRowRaw, baseMarginPercent)]);
    setSearchTerm('');
    setShowDropdown(false);
    setActiveTab('quote'); // Switch to Quote tab to see the new item
  };

  const removeRow = (uid) => setRows(rows.filter(r => r.uid !== uid));

  // 4. Update specific fields (User edits a cell)
  const updateRow = (uid, field, value) => {
    const val = value === '' ? 0 : parseFloat(value);
    setRows(rows.map(row => {
        if (row.uid !== uid) return row;
        const updated = { ...row, [field]: val };

        if (field === 'transAmt') {
             // Reverse calculate Trans% if user types Amount
             updated.transPercent = row.factoryPrice > 0 ? (val / row.factoryPrice) * 100 : 0;
        } else if (field === 'marginAmt') {
             // Reverse calculate Margin% if user types Amount
             const cost = row.internalCost;
             updated.marginPercent = cost > 0 ? (val / cost) * 100 : 0;
             updated.quotedPrice = cost + val;
             return { ...updated, marginAmt: val }; 
        } else if (field === 'quotedPrice') {
            // Reverse calculate Margin if user types Final Price
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

  // 5. Handle Total Amount Override (Reverse Calculate Quoted Rate)
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

  // ====================================================================
  //  SEARCH & PDF LOGIC
  // ====================================================================
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

  const handleDownloadPDF = () => {
    setIsPdfGenerating(true);
    const wasInClientMode = isClientMode;
    if (!isClientMode) setIsClientMode(true);

    setTimeout(() => {
        const element = pdfRef.current;
        html2pdf().set({ 
            margin: [5, 5, 5, 5], 
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
  
  const dynamicTextStyle = {
      width: '100%', 
      border: '1px dashed #ccc', 
      background: 'transparent', 
      resize: 'vertical',
      minHeight: '20px',
      fontFamily: 'inherit',
      fontSize: `${bodyFontSize}pt`,
      color: bodyColor,
      fontWeight: isBodyBold ? 'bold' : 'normal'
  };
  
  const sectionTitleStyle = { fontSize: '10px', fontWeight: 'bold', textDecoration: 'underline', marginTop: '6px', marginBottom: '2px' };

  // --- HEADER COMPONENT ---
  const DocumentHeader = () => (
    <div style={{ marginBottom: '10px', textAlign: 'center' }}>
      {logoUrl ? (
          <img 
            src={logoUrl} 
            alt="Header" 
            style={{ width: '100%', height: 'auto', maxHeight: '140px', objectFit: 'contain' }} 
          />
      ) : (
          <div style={{ padding:'20px', border:'2px dashed #ccc', color:'#999', background:'#f8f9fa' }}>
              Upload Header Image using the controls above
          </div>
      )}
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

        {/* MIDDLE ROW: VISUAL SETTINGS */}
        {!isClientMode && activeTab === 'cover' && (
            <div style={{ display:'flex', gap:'20px', alignItems:'center', background:'#f1f3f5', padding:'10px', borderRadius:'6px' }}>
                <div style={{ fontWeight:'bold', fontSize:'12px', color:'#555' }}>LETTER STYLE:</div>
                <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
                    <label style={{ fontSize:'12px', fontWeight:'bold' }}>Header Img:</label>
                    <input type="file" accept="image/*" onChange={handleImageUpload} style={{ fontSize:'11px' }} />
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
                    <label style={{ fontSize:'12px', fontWeight:'bold' }}>Size:</label>
                    <input type="number" value={bodyFontSize} onChange={(e) => setBodyFontSize(e.target.value)} style={{ width:'40px', padding:'2px' }} />
                    <span style={{ fontSize:'11px' }}>pt</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
                    <label style={{ fontSize:'12px', fontWeight:'bold' }}>Color:</label>
                    <input type="color" value={bodyColor} onChange={(e) => setBodyColor(e.target.value)} style={{ height:'25px', width:'30px', padding:'0', border:'none' }} />
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
                    <label style={{ fontSize:'12px', fontWeight:'bold' }}>Bold:</label>
                    <input type="checkbox" checked={isBodyBold} onChange={(e) => setIsBodyBold(e.target.checked)} />
                </div>
            </div>
        )}

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

      {/* --- SEARCH BAR --- */}
      {(!isClientMode && activeTab === 'quote') && (
        <div ref={searchRef} style={{ position: 'relative', marginBottom: '20px' }}>
            <input type="text" placeholder="Search Item to Add to Quote..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setShowDropdown(true); }}
                style={{ width: '100%', padding: '15px', borderRadius: '8px', border: '1px solid #ced4da', fontSize: '16px', boxShadow:'0 2px 5px rgba(0,0,0,0.05)' }} />
            {showDropdown && searchResults.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', maxHeight: '400px', overflowY: 'auto', border: '1px solid #ccc', zIndex: 1000, boxShadow: '0 10px 20px rgba(0,0,0,0.15)', borderRadius:'0 0 8px 8px' }}>
                    {searchResults.map((item, idx) => {
                        // Display price logic for Search Dropdown
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
        
        {/* ======================= PAGE 1: COVERING LETTER ======================= */}
        <div className="page-1" style={{ fontSize: `${bodyFontSize}pt`, lineHeight: '1.2', color: bodyColor, fontWeight: isBodyBold ? 'bold' : 'normal', display: (activeTab === 'cover' || isPdfGenerating) ? 'block' : 'none' }}>
            
            <DocumentHeader />

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontWeight: 'bold', fontSize: 'inherit' }}>
                <div>Ref: <input value={coverRef} onChange={(e) => setCoverRef(e.target.value)} style={{ border: 'none', fontWeight: 'bold', width: '150px', fontSize: 'inherit', color:'inherit' }} /></div>
                <div>Date: <input value={coverDate} onChange={(e) => setCoverDate(e.target.value)} style={{ border: 'none', fontWeight: 'bold', width: '100px', textAlign: 'right', fontSize: 'inherit', color:'inherit' }} /></div>
            </div>

            <div style={{ marginBottom: '8px' }}>
                <div style={{fontWeight:'bold'}}>TO,</div>
                <input value={coverToName} onChange={(e) => setCoverToName(e.target.value)} style={{ ...dynamicTextStyle, fontWeight: 'bold', border:'none', padding:'0' }} />
                <input value={coverToCompany} onChange={(e) => {setCoverToCompany(e.target.value);}} style={{ ...dynamicTextStyle, fontWeight: 'bold', border:'none', padding:'0' }} />
                <input value={coverToAddress} onChange={(e) => setCoverToAddress(e.target.value)} style={{ ...dynamicTextStyle, border:'none', padding:'0' }} />
            </div>

            <div style={{ marginBottom: '8px' }}>Dear Sir,</div>

            <div style={{ marginBottom: '8px', fontWeight: 'bold', textDecoration:'underline' }}>
                SUB: <input value={coverSubject} onChange={(e) => setCoverSubject(e.target.value)} style={{ ...dynamicTextStyle, fontWeight: 'bold', width: '85%', display: 'inline-block', border:'none', textDecoration:'underline' }} />
            </div>

            <div style={{ marginBottom: '6px' }}>
                <textarea value={coverBody1} onChange={(e) => setCoverBody1(e.target.value)} style={{ ...dynamicTextStyle, minHeight: 'auto', border: 'none', overflow:'hidden' }} rows={2} />
            </div>
            <div style={{ marginBottom: '6px' }}>
                <textarea value={coverBody2} onChange={(e) => setCoverBody2(e.target.value)} style={{ ...dynamicTextStyle, minHeight: 'auto', border: 'none', overflow:'hidden' }} rows={2} />
            </div>
            <div style={{ marginBottom: '8px' }}>
                <textarea value={coverBody3} onChange={(e) => setCoverBody3(e.target.value)} style={{ ...dynamicTextStyle, minHeight: 'auto', border: 'none', overflow:'hidden' }} rows={2} />
            </div>

            <div style={{ marginTop: '5px', borderTop: '1px solid #000', paddingTop: '5px' }}>
                <div style={{ fontWeight: 'bold', textAlign: 'center', textDecoration: 'underline', marginBottom: '5px', fontSize:'9pt' }}>TERMS AND CONDITIONS</div>
                <div style={{ fontSize: '9pt', display:'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', color:'#000', fontWeight:'normal' }}>
                    <div>
                        <div style={sectionTitleStyle}>TAXES:</div>
                        <textarea value={termTaxes} onChange={(e) => setTermTaxes(e.target.value)} style={{ ...dynamicTextStyle, border: 'none', fontSize:'9pt' }} rows={2} />
                        <div style={sectionTitleStyle}>WARRANTY:</div>
                        <textarea value={termWarranty} onChange={(e) => setTermWarranty(e.target.value)} style={{ ...dynamicTextStyle, border: 'none', fontSize:'9pt' }} rows={2} />
                        <div style={sectionTitleStyle}>PAYMENT:</div>
                        <textarea value={termPayment} onChange={(e) => setTermPayment(e.target.value)} style={{ ...dynamicTextStyle, border: 'none', fontSize:'9pt' }} rows={4} />
                    </div>
                    <div>
                        <div style={sectionTitleStyle}>SUPPLY/INSTALLATION:</div>
                        <textarea value={termSupply} onChange={(e) => setTermSupply(e.target.value)} style={{ ...dynamicTextStyle, border: 'none', fontSize:'9pt' }} rows={5} />
                        <div style={sectionTitleStyle}>AFTER SALES SUPPORT:</div>
                        <textarea value={termSupport} onChange={(e) => setTermSupport(e.target.value)} style={{ ...dynamicTextStyle, border: 'none', fontSize:'9pt' }} rows={3} />
                    </div>
                </div>
            </div>

            <div style={{ marginTop: '10px' }}>
                <div>Yours truly,</div>
                <div style={{ fontWeight: 'bold' }}>For United Biomedical Services,</div>
                <div style={{ marginTop: '20px' }}>
                    <input value={signatoryName} onChange={(e) => setSignatoryName(e.target.value)} style={{ border: 'none', fontWeight: 'bold', display: 'block', fontSize:'11pt', width:'100%' }} />
                    <input value={signatoryPhone} onChange={(e) => setSignatoryPhone(e.target.value)} style={{ border: 'none', display: 'block', fontSize:'10pt', width:'100%' }} />
                </div>
            </div>
        </div> 

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
                    let subTotalAmt = 0; let subTotalCost = 0; let subTotalGross = 0;
                    catRows.forEach(r => { subTotalAmt += r.quotedPrice * r.qty; subTotalCost += r.internalCost * r.qty; subTotalGross += (r.quotedPrice - r.internalCost) * r.qty; });

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
      </div>
    </div>
  );
}