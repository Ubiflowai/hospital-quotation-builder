import React, { useState, useEffect, useRef } from 'react';
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

  // --- STATE: VISUALS & STYLES ---
  const [logoUrl, setLogoUrl] = useState(null); 
  const [bodyFontSize, setBodyFontSize] = useState(11); 
  const [bodyColor, setBodyColor] = useState("#000000"); 
  const [isBodyBold, setIsBodyBold] = useState(false); 
  
  // ZOOM State
  const [zoomLevel, setZoomLevel] = useState(1.0); 

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
  
  // --- CUSTOM ITEM INPUTS ---
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');

  const searchRef = useRef(null);

  // --- HANDLER: IMAGE UPLOAD ---
  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setLogoUrl(url);
    }
  };

  // --- ZOOM HANDLERS ---
  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.1, 2.0));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.1, 0.5));

  // --- CALCULATION LOGIC ---
  const calculateRow = (row, overrideMargin = null) => {
    const marginPct = overrideMargin !== null ? overrideMargin : row.marginPercent;
    const transAmt = row.factoryPrice * (row.transPercent / 100);
    const internalCost = row.factoryPrice + transAmt + row.fittingCost + row.saddleCost + row.workCost;
    const marginAmt = internalCost * (marginPct / 100);
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

  const handleCopperRateChange = (newRate) => {
      const rate = parseFloat(newRate) || 0;
      setCopperRate(rate);
      setRows(rows.map(row => {
          if (row.categoryId === 1000) {
              const category = productCatalog.find(c => c.id === 1000);
              const catalogItem = category?.items.find(i => i.id === row.id);
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

    let startPrice = 0;
    if (product.weight !== undefined) {
        startPrice = product.weight * copperRate;
    } else if (product.factoryPrice !== undefined) {
        startPrice = product.factoryPrice;
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

  // --- ADD CUSTOM ITEM FUNCTION ---
  const addCustomItem = () => {
      if (!customItemName) return;
      
      const customCategoryId = 9999; 
      
      if (!categoryOrder.includes(customCategoryId)) {
          setCategoryOrder([...categoryOrder, customCategoryId]);
      }
      
      // Ensure "Custom Items" category exists in catalog for display
      const existingCat = productCatalog.find(c => c.id === customCategoryId);
      if (!existingCat) {
          productCatalog.push({ id: customCategoryId, name: "Custom Items", items: [] });
      }

      const price = parseFloat(customItemPrice) || 0;
      const newRowRaw = {
          uid: Date.now(),
          id: `custom-${Date.now()}`,
          categoryId: customCategoryId,
          name: customItemName,
          hsn: "Gen",
          unit: "nos",
          qty: 1,
          factoryPrice: price,
          transPercent: 0,
          fittingCost: 0,
          saddleCost: 0,
          workCost: 0,
          marginPercent: baseMarginPercent,
      };

      setRows([...rows, calculateRow(newRowRaw, baseMarginPercent)]);
      setCustomItemName('');
      setCustomItemPrice('');
      setActiveTab('quote');
  };

  const removeRow = (uid) => setRows(rows.filter(r => r.uid !== uid));

  const updateRow = (uid, field, value) => {
    // 1. EDIT DESCRIPTION OR UNIT (Text Fields)
    if (field === 'name' || field === 'unit' || field === 'hsn') {
        setRows(rows.map(row => {
            if(row.uid !== uid) return row;
            return { ...row, [field]: value };
        }));
        return;
    }

    // 2. NUMBER FIELDS
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

  // --- PDF GENERATION ---
  const handleDownloadPDF = () => {
    setIsPdfGenerating(true);
    const wasInClientMode = isClientMode;
    if (!isClientMode) setIsClientMode(true);
    
    setTimeout(() => {
        const element = pdfRef.current;
        html2pdf().set({ 
            margin: [2, 2, 2, 2], 
            filename: `Quote_${coverRef.replace(/\//g, '-')}.pdf`, 
            html2canvas: { scale: 3, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }, 
            pagebreak: { mode: ['css', 'legacy'] } 
        }).from(element).save().then(() => {
             setIsPdfGenerating(false);
             if (!wasInClientMode) setIsClientMode(false);
        });
    }, 500);
  };

  // --- STYLES & LAYOUT LOGIC ---
  const isPrint = isClientMode || isPdfGenerating;

  const tableWidth = isPrint ? '100%' : 'max-content';
  const minTableWidth = isPrint ? '280mm' : '1800px';

  const tableStyle = {
      width: tableWidth,
      minWidth: minTableWidth,
      borderCollapse: 'collapse',
      fontSize: isPrint ? '10px' : '12px',
      tableLayout: 'fixed', 
  };

  const tableHeaderStyle = { 
      background: '#f8f9fa', 
      color: '#555', 
      textTransform: 'uppercase', 
      fontSize: isPrint ? '9px' : '11px', 
      fontWeight: 'bold', 
      padding: isPrint ? '4px 2px' : '8px 4px', 
      borderBottom:'2px solid #ddd',
      textAlign: 'center',
      letterSpacing: '0.5px',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
  };

  const getColWidth = (type) => {
      if (!isPrint) {
          // EDIT MODE: Wide
          switch(type) {
              case 'index': return '40px';
              case 'desc': return '350px';
              case 'cost': return '90px';
              case 'small': return '70px';
              case 'med': return '90px';
              case 'rate': return '120px';
              case 'amt': return '150px';
              default: return 'auto';
          }
      } else {
          // PRINT MODE: Tight
          switch(type) {
              case 'index': return '25px';
              case 'desc': return 'auto'; 
              case 'cost': return '55px';
              case 'small': return '35px';
              case 'med': return '50px';
              case 'rate': return '65px';
              case 'amt': return '75px';
              default: return 'auto';
          }
      }
  };

  const inputStyle = { 
      width: '100%', 
      border: 'none', 
      borderBottom: '1px solid #eee', 
      background: 'transparent', 
      padding: '0', 
      margin: '0',
      borderRadius: '0', 
      textAlign:'center', 
      fontSize: 'inherit',
      color: '#333',
      outline: 'none',
      boxSizing: 'border-box',
      height: '24px' 
  };

  const readOnlyStyle = { ...inputStyle, borderBottom: 'none', fontWeight:'600', color:'#444' };
  
  const dynamicTextStyle = {
      width: '100%', 
      border: '1px dashed #e0e0e0', 
      background: 'transparent', 
      resize: 'vertical',
      minHeight: '20px',
      fontFamily: 'inherit',
      fontSize: `${bodyFontSize}pt`,
      color: bodyColor,
      fontWeight: isBodyBold ? 'bold' : 'normal',
      padding: '5px'
  };
  
  const sectionTitleStyle = { fontSize: '10px', fontWeight: 'bold', textDecoration: 'underline', marginTop: '6px', marginBottom: '2px', color: '#444' };

  const DocumentHeader = () => (
    <div style={{ marginBottom: '15px', textAlign: 'center' }}>
      {logoUrl ? (
          <img 
            src={logoUrl} 
            alt="Header" 
            style={{ width: '100%', height: 'auto', maxHeight: '140px', objectFit: 'contain' }} 
          />
      ) : (
          <div style={{ padding:'20px', border:'2px dashed #ccc', color:'#999', background:'#f8f9fa', borderRadius:'8px' }}>
              Upload Header Image using the controls above
          </div>
      )}
    </div>
  );

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', backgroundColor: '#e9ecef', width: '100vw', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom:'120px', overflowX: 'hidden' }}>
      
      {/* --- CONTROL BAR --- */}
      <div style={{ width: '95%', maxWidth: '1400px', marginTop: '20px', marginBottom: '20px', display: 'flex', flexDirection:'column', gap:'15px', background: 'white', padding: '15px 20px', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
        
        {/* TOP ROW */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #f0f0f0', paddingBottom:'10px'}}>
             <h2 style={{ margin: 0, color: '#2c3e50', fontSize: '20px' }}>Quotation Manager</h2>
             <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                 <div style={{ display:'flex', alignItems:'center', gap:'5px', background:'#f1f3f5', padding:'5px 10px', borderRadius:'20px' }}>
                     <span style={{ fontSize:'12px', fontWeight:'bold', color:'#777', marginRight:'5px' }}>ZOOM:</span>
                     <button onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.1))} style={{ cursor:'pointer', width:'25px', height:'25px', borderRadius:'50%', border:'none', background:'#ddd', fontWeight:'bold' }}>-</button>
                     <span style={{ fontSize:'12px', minWidth:'35px', textAlign:'center' }}>{Math.round(zoomLevel * 100)}%</span>
                     <button onClick={() => setZoomLevel(z => Math.min(2.0, z + 0.1))} style={{ cursor:'pointer', width:'25px', height:'25px', borderRadius:'50%', border:'none', background:'#ddd', fontWeight:'bold' }}>+</button>
                 </div>
                 <div style={{ display:'flex', gap:'10px' }}>
                     <button onClick={() => setActiveTab('cover')} style={{ padding: '8px 20px', cursor: 'pointer', borderRadius: '20px', fontWeight: '600', border: 'none', background: activeTab === 'cover' ? '#3498db' : '#f1f3f5', color: activeTab === 'cover' ? 'white' : '#555', transition: 'all 0.2s' }}>
                        1. Edit Cover Letter
                     </button>
                     <button onClick={() => setActiveTab('quote')} style={{ padding: '8px 20px', cursor: 'pointer', borderRadius: '20px', fontWeight: '600', border: 'none', background: activeTab === 'quote' ? '#3498db' : '#f1f3f5', color: activeTab === 'quote' ? 'white' : '#555', transition: 'all 0.2s' }}>
                        2. Edit Quotation
                     </button>
                 </div>
             </div>
        </div>

        {/* MIDDLE ROW: VISUAL SETTINGS */}
        {!isClientMode && activeTab === 'cover' && (
            <div style={{ display:'flex', gap:'20px', alignItems:'center', background:'#f8f9fa', padding:'10px', borderRadius:'6px' }}>
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

        {/* BOTTOM ROW: GLOBAL SETTINGS & CUSTOM ITEM */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
             {!isClientMode ? (
                 <div style={{ display: 'flex', gap:'20px', alignItems:'center' }}>
                     <div style={{ display: 'flex', alignItems: 'center', background: '#fff9db', padding: '6px 15px', borderRadius: '20px', border:'1px solid #ffe066' }}>
                        <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#e67700', marginRight: '10px' }}>Copper Market Rate:</span>
                        <input type="number" value={copperRate} onChange={(e) => handleCopperRateChange(e.target.value)}
                            style={{ width: '80px', padding: '4px', borderRadius: '4px', border: '1px solid #ffe066', textAlign: 'center', fontWeight:'bold', color: '#e67700' }} />
                    </div>
                    {/* CUSTOM ITEM ADDER */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background:'#e6f7ff', padding:'6px 15px', borderRadius:'20px', border:'1px solid #1890ff' }}>
                        <span style={{ fontSize:'13px', fontWeight:'bold', color:'#0050b3' }}>+ Custom Item:</span>
                        <input placeholder="Item Name..." value={customItemName} onChange={(e) => setCustomItemName(e.target.value)} 
                            style={{ width:'150px', padding:'5px', borderRadius:'4px', border:'1px solid #ccc', outline:'none' }} />
                        <input type="number" placeholder="Price..." value={customItemPrice} onChange={(e) => setCustomItemPrice(e.target.value)} 
                            style={{ width:'70px', padding:'5px', borderRadius:'4px', border:'1px solid #ccc', outline:'none' }} />
                        <button onClick={addCustomItem} style={{ background:'#1890ff', color:'white', border:'none', borderRadius:'4px', padding:'5px 10px', cursor:'pointer', fontWeight:'bold' }}>Add</button>
                    </div>
                 </div>
             ) : <div></div>}

            <div style={{display:'flex', gap:'10px'}}>
                <button onClick={() => setIsClientMode(!isClientMode)} style={{ padding: '10px 20px', background: isClientMode ? '#2ecc71' : '#95a5a6', color:'white', border: 'none', borderRadius: '6px', cursor:'pointer', fontWeight:'bold', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
                    {isClientMode ? "Exit Client Mode" : "Client Mode"}
                </button>
                <button onClick={handleDownloadPDF} style={{ padding: '10px 20px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '6px', cursor:'pointer', fontWeight:'bold', boxShadow: '0 2px 5px rgba(231, 76, 60, 0.3)' }}>
                    Download PDF
                </button>
            </div>
        </div>
      </div>

      {/* --- SEARCH BAR --- */}
      {(!isClientMode && activeTab === 'quote') && (
        <div ref={searchRef} style={{ width: '95%', maxWidth: '1400px', position: 'relative', marginBottom: '20px' }}>
            <input type="text" placeholder="+ Add Item from Catalog (Type name...)" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setShowDropdown(true); }}
                style={{ width: '100%', padding: '15px 20px', borderRadius: '8px', border: '1px solid #e0e0e0', fontSize: '16px', boxShadow:'0 2px 8px rgba(0,0,0,0.03)', outline:'none', boxSizing: 'border-box' }} />
            {showDropdown && searchResults.length > 0 && (
                <div style={{ position: 'absolute', top: '105%', left: 0, right: 0, background: 'white', maxHeight: '400px', overflowY: 'auto', border: '1px solid #eee', zIndex: 1000, boxShadow: '0 10px 30px rgba(0,0,0,0.1)', borderRadius:'8px' }}>
                    {searchResults.map((item, idx) => {
                        let displayPrice = item.factoryPrice;
                        if(item.weight !== undefined) displayPrice = item.weight * copperRate;
                        return (
                            <div key={idx} onClick={() => addRow(item.id, item.categoryId)} 
                                style={{ padding: '12px 20px', borderBottom: '1px solid #f8f9fa', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems:'center' }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#f1f8ff'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'white'}>
                                <div><span style={{ fontWeight: '600', color:'#3498db', fontSize:'14px' }}>{item.categoryName}</span> <span style={{color:'#555'}}>— {item.name}</span></div>
                                <div style={{ color: '#888', fontSize:'13px', background:'#f8f9fa', padding:'2px 8px', borderRadius:'4px' }}>Base: ₹{displayPrice?.toFixed(0)}</div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
      )}

      {/* ===================================================================================== */}
      {/* PDF DOCUMENT WRAPPER (SCROLLABLE & WIDE)                                              */}
      {/* ===================================================================================== */}
      
      <div style={{ 
          overflow: 'auto', 
          width: '100%', 
          display: 'flex', 
          // Align LEFT so horizontal scroll works naturally in edit mode
          justifyContent: isPrint ? 'center' : 'flex-start', 
          padding: '20px', 
          boxSizing: 'border-box' 
      }}>
          {/* Zoom Wrapper */}
          <div style={{ 
              transform: `scale(${zoomLevel})`, 
              transformOrigin: 'top left',
              transition: 'transform 0.2s ease',
              marginBottom: '100px',
              minWidth: isPrint ? 'auto' : 'auto'
          }}>
              <div ref={pdfRef} style={{ 
                  background: 'white', 
                  width: isPrint ? '280mm' : 'auto', 
                  minWidth: isPrint ? '280mm' : '1800px', // Forces horizontal scroll in Edit Mode
                  minHeight: '210mm', 
                  margin: '0 auto', 
                  padding: isPrint ? '10mm' : '20px', 
                  boxShadow: '0 10px 40px rgba(0,0,0,0.1)', 
                  boxSizing: 'border-box',
                  display: 'inline-block' 
              }}>
                
                {/* ======================= PAGE 1: COVERING LETTER ======================= */}
                <div className="page-1" style={{ fontSize: `${bodyFontSize}pt`, lineHeight: '1.4', color: bodyColor, fontWeight: isBodyBold ? 'bold' : 'normal', display: (activeTab === 'cover' || isPdfGenerating) ? 'block' : 'none' }}>
                    <DocumentHeader />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontWeight: '600', fontSize: 'inherit' }}>
                        <div>Ref: <input value={coverRef} onChange={(e) => setCoverRef(e.target.value)} style={{ border: 'none', fontWeight: 'bold', width: '200px', fontSize: 'inherit', color:'inherit', outline:'none' }} /></div>
                        <div>Date: <input value={coverDate} onChange={(e) => setCoverDate(e.target.value)} style={{ border: 'none', fontWeight: 'bold', width: '120px', textAlign: 'right', fontSize: 'inherit', color:'inherit', outline:'none' }} /></div>
                    </div>
                    {/* ... (Cover letter content) ... */}
                    <div style={{ marginBottom: '20px' }}>
                        <div style={{fontWeight:'bold', marginBottom:'5px'}}>TO,</div>
                        <input value={coverToName} onChange={(e) => setCoverToName(e.target.value)} style={{ ...dynamicTextStyle, fontWeight: 'bold', border:'none', padding:'0' }} />
                        <input value={coverToCompany} onChange={(e) => {setCoverToCompany(e.target.value);}} style={{ ...dynamicTextStyle, fontWeight: 'bold', border:'none', padding:'0' }} />
                        <input value={coverToAddress} onChange={(e) => setCoverToAddress(e.target.value)} style={{ ...dynamicTextStyle, border:'none', padding:'0' }} />
                    </div>
                    <div style={{ marginBottom: '15px' }}>Dear Sir,</div>
                    <div style={{ marginBottom: '15px', fontWeight: 'bold', textDecoration:'underline' }}>
                        SUB: <input value={coverSubject} onChange={(e) => setCoverSubject(e.target.value)} style={{ ...dynamicTextStyle, fontWeight: 'bold', width: '90%', display: 'inline-block', border:'none', textDecoration:'underline' }} />
                    </div>
                    <div style={{ marginBottom: '10px' }}><textarea value={coverBody1} onChange={(e) => setCoverBody1(e.target.value)} style={{ ...dynamicTextStyle, minHeight: 'auto', border: 'none', overflow:'hidden' }} rows={2} /></div>
                    <div style={{ marginBottom: '10px' }}><textarea value={coverBody2} onChange={(e) => setCoverBody2(e.target.value)} style={{ ...dynamicTextStyle, minHeight: 'auto', border: 'none', overflow:'hidden' }} rows={2} /></div>
                    <div style={{ marginBottom: '20px' }}><textarea value={coverBody3} onChange={(e) => setCoverBody3(e.target.value)} style={{ ...dynamicTextStyle, minHeight: 'auto', border: 'none', overflow:'hidden' }} rows={2} /></div>
                    <div style={{ marginTop: '10px', borderTop: '2px solid #333', paddingTop: '10px' }}>
                        <div style={{ fontWeight: 'bold', textAlign: 'center', textDecoration: 'underline', marginBottom: '10px', fontSize:'10pt' }}>TERMS AND CONDITIONS</div>
                        <div style={{ fontSize: '9pt', display:'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', color:'#000', fontWeight:'normal' }}>
                            <div>
                                <div style={sectionTitleStyle}>TAXES:</div><textarea value={termTaxes} onChange={(e) => setTermTaxes(e.target.value)} style={{ ...dynamicTextStyle, border: 'none', fontSize:'9pt' }} rows={2} />
                                <div style={sectionTitleStyle}>WARRANTY:</div><textarea value={termWarranty} onChange={(e) => setTermWarranty(e.target.value)} style={{ ...dynamicTextStyle, border: 'none', fontSize:'9pt' }} rows={2} />
                                <div style={sectionTitleStyle}>PAYMENT:</div><textarea value={termPayment} onChange={(e) => setTermPayment(e.target.value)} style={{ ...dynamicTextStyle, border: 'none', fontSize:'9pt' }} rows={5} />
                            </div>
                            <div>
                                <div style={sectionTitleStyle}>SUPPLY/INSTALLATION:</div><textarea value={termSupply} onChange={(e) => setTermSupply(e.target.value)} style={{ ...dynamicTextStyle, border: 'none', fontSize:'9pt' }} rows={6} />
                                <div style={sectionTitleStyle}>AFTER SALES SUPPORT:</div><textarea value={termSupport} onChange={(e) => setTermSupport(e.target.value)} style={{ ...dynamicTextStyle, border: 'none', fontSize:'9pt' }} rows={4} />
                            </div>
                        </div>
                    </div>
                    <div style={{ marginTop: '30px' }}>
                        <div>Yours truly,</div>
                        <div style={{ fontWeight: 'bold', marginTop:'5px' }}>For United Biomedical Services,</div>
                        <div style={{ marginTop: '30px' }}>
                            <input value={signatoryName} onChange={(e) => setSignatoryName(e.target.value)} style={{ border: 'none', fontWeight: 'bold', display: 'block', fontSize:'11pt', width:'100%', outline:'none' }} />
                            <input value={signatoryPhone} onChange={(e) => setSignatoryPhone(e.target.value)} style={{ border: 'none', display: 'block', fontSize:'10pt', width:'100%', outline:'none' }} />
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
                        <h2 style={{ margin: '0 0 5px 0', color: '#444', textTransform:'uppercase', fontSize:'18px', letterSpacing:'1px' }}>Quotation Details</h2>
                        <div style={{ fontSize: '12px', color:'#666' }}>Ref: {coverRef}</div>
                        <div style={{ fontSize: '12px', color:'#666' }}>Date: {coverDate}</div>
                    </div>

                    <table style={tableStyle}>
                        <thead>
                            <tr style={{height:'35px'}}>
                                <th style={{...tableHeaderStyle, width: getColWidth('index')}}>#</th>
                                <th style={{...tableHeaderStyle, textAlign:'left', paddingLeft:'5px', width: getColWidth('desc')}}>Description</th>
                                {!isClientMode && (
                                    <>
                                        <th style={{...tableHeaderStyle, width: getColWidth('cost'), background:'#f3f3f3'}}>Base</th>
                                        <th style={{...tableHeaderStyle, width: getColWidth('small'), background:'#f3f3f3'}}>Trn%</th>
                                        <th style={{...tableHeaderStyle, width: getColWidth('small'), background:'#f3f3f3'}}>Trn.₹</th>
                                        <th style={{...tableHeaderStyle, width: getColWidth('cost'), background:'#f3f3f3'}}>Fit</th>
                                        <th style={{...tableHeaderStyle, width: getColWidth('cost'), background:'#f3f3f3'}}>Sadl</th>
                                        <th style={{...tableHeaderStyle, width: getColWidth('cost'), background:'#f3f3f3'}}>Work</th>
                                        <th style={{...tableHeaderStyle, width: getColWidth('cost'), background:'#e9ecef'}}>Total</th>
                                        <th style={{...tableHeaderStyle, width: getColWidth('small'), background:'#e9ecef'}}>Mrg%</th>
                                        <th style={{...tableHeaderStyle, width: getColWidth('med'), background:'#e9ecef'}}>Mrg.₹</th>
                                    </>
                                )}
                                <th style={{...tableHeaderStyle, width: getColWidth('small')}}>Qty</th>
                                <th style={{...tableHeaderStyle, width: getColWidth('small')}}>Unit</th>
                                <th style={{...tableHeaderStyle, width: getColWidth('rate')}}>Rate</th>
                                <th style={{...tableHeaderStyle, width: getColWidth('amt')}}>Amount</th>
                                {!isClientMode && (
                                    <>
                                        <th style={{...tableHeaderStyle, width: getColWidth('med'), background:'#e6fffa', color:'#006644'}}>P.Marg</th>
                                        <th style={{...tableHeaderStyle, width: getColWidth('small'), background:'#e6fffa', color:'#006644'}}>P.%</th>
                                        <th style={{...tableHeaderStyle, width: getColWidth('rate'), background:'#ccfce3', color:'#006644'}}>Gross</th>
                                        <th style={{...tableHeaderStyle, width:'30px', background:'#fff', borderBottom:'none'}}></th>
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
                                <React.Fragment key={catId}>
                                    <tr>
                                        <td colSpan={isClientMode ? 5 : 18} style={{ padding: '15px 5px', fontWeight: 'bold', color:'#2c3e50', fontSize:'11px', borderBottom:'2px solid #eee' }}>
                                            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                                <span>{category?.name}</span>
                                                {!isClientMode && (
                                                    <div style={{ fontSize:'10px' }}>
                                                        <button onClick={() => moveCategory(catIndex, 'up')} style={{cursor:'pointer', border:'none', background:'none', padding:'0 5px'}}>▲</button>
                                                        <button onClick={() => moveCategory(catIndex, 'down')} style={{cursor:'pointer', border:'none', background:'none', padding:'0 5px'}}>▼</button>
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
                                                <td style={{ textAlign: 'center', padding:'4px', color:'#999' }}>{index + 1}</td>
                                                {/* --- EDITABLE DESCRIPTION (NAME) --- */}
                                                <td style={{ padding:'4px', fontWeight:'500' }}>
                                                    {isClientMode ? (
                                                        row.name
                                                    ) : (
                                                        <input value={row.name} onChange={(e) => updateRow(row.uid, 'name', e.target.value)} style={{ ...inputStyle, textAlign:'left', fontWeight:'bold', color: row.categoryId === 9999 ? '#0050b3' : '#333' }} />
                                                    )}
                                                </td>
                                                {!isClientMode && (
                                                    <>
                                                        <td style={{padding:'2px', background:'#fdfdfd'}}><input type="number" value={row.factoryPrice.toFixed(0)} onChange={(e)=>updateRow(row.uid, 'factoryPrice', e.target.value)} style={inputStyle} /></td>
                                                        <td style={{padding:'2px', background:'#fdfdfd'}}><input type="number" value={row.transPercent} onChange={(e)=>updateRow(row.uid, 'transPercent', e.target.value)} style={inputStyle} /></td>
                                                        <td style={{padding:'2px', background:'#fdfdfd'}}><input type="number" value={row.transAmt.toFixed(0)} onChange={(e)=>updateRow(row.uid, 'transAmt', e.target.value)} style={readOnlyStyle} tabIndex="-1" /></td>
                                                        <td style={{padding:'2px', background:'#fdfdfd'}}><input type="number" value={row.fittingCost} onChange={(e)=>updateRow(row.uid, 'fittingCost', e.target.value)} style={inputStyle} /></td>
                                                        <td style={{padding:'2px', background:'#fdfdfd'}}><input type="number" value={row.saddleCost} onChange={(e)=>updateRow(row.uid, 'saddleCost', e.target.value)} style={inputStyle} /></td>
                                                        <td style={{padding:'2px', background:'#fdfdfd'}}><input type="number" value={row.workCost} onChange={(e)=>updateRow(row.uid, 'workCost', e.target.value)} style={inputStyle} /></td>
                                                        <td style={{padding:'2px', background:'#f8f9fa', color:'#666', textAlign:'center', fontSize:'10px'}}>{row.internalCost.toFixed(0)}</td>
                                                        <td style={{padding:'2px', background:'#f8f9fa'}}><input type="number" value={row.marginPercent.toFixed(1)} onChange={(e)=>updateRow(row.uid, 'marginPercent', e.target.value)} style={inputStyle} /></td>
                                                        <td style={{padding:'2px', background:'#f8f9fa'}}><input type="number" value={row.marginAmt.toFixed(0)} onChange={(e)=>updateRow(row.uid, 'marginAmt', e.target.value)} style={inputStyle} /></td>
                                                    </>
                                                )}
                                                <td style={{padding:'2px'}}>
                                                    {isClientMode ? <div style={{textAlign:'center', padding:'4px'}}>{row.qty}</div> : <input type="number" value={row.qty} onChange={(e)=>updateRow(row.uid, 'qty', e.target.value)} style={{...inputStyle, textAlign:'center', fontWeight:'bold'}} />}
                                                </td>
                                                {/* --- EDITABLE UNIT --- */}
                                                <td style={{padding:'2px'}}>
                                                    {isClientMode ? (
                                                        <div style={{textAlign:'center', color:'#888', fontSize:'10px'}}>{row.unit}</div>
                                                    ) : (
                                                        <input value={row.unit} onChange={(e) => updateRow(row.uid, 'unit', e.target.value)} style={{ ...inputStyle, textAlign:'center', color:'#888' }} />
                                                    )}
                                                </td>
                                                <td style={{padding:'2px'}}>
                                                    {isClientMode ? <div style={{textAlign:'right', padding:'4px'}}>{row.quotedPrice.toFixed(2)}</div> : <input type="number" value={row.quotedPrice} onChange={(e)=>updateRow(row.uid, 'quotedPrice', e.target.value)} style={{...inputStyle, fontWeight:'bold', color:'#2980b9'}} />}
                                                </td>
                                                <td style={{padding:'2px', textAlign:'right', fontWeight:'bold'}}>
                                                    {isClientMode ? (row.quotedPrice * row.qty).toLocaleString('en-IN') : <input type="number" value={(row.quotedPrice * row.qty).toFixed(2)} onChange={(e)=>handleRowAmountChange(row.uid, e.target.value)} style={{...readOnlyStyle, color:'#333'}} />}
                                                </td>
                                                {!isClientMode && (
                                                    <>
                                                        <td style={{textAlign:'right', paddingRight:'5px', color: actualProfit < 0 ? 'red' : '#27ae60', background:'#f0fff4', fontSize:'10px'}}>{actualProfit.toFixed(0)}</td>
                                                        <td style={{textAlign:'right', paddingRight:'5px', color: '#888', background:'#f0fff4', fontSize:'10px'}}>{actualProfitPercent.toFixed(1)}%</td>
                                                        <td style={{textAlign:'right', paddingRight:'5px', fontWeight:'bold', color: totalGross < 0 ? 'red' : '#219150', background:'#e6fffa'}}>{totalGross.toFixed(0)}</td>
                                                        <td style={{textAlign:'center'}}><button onClick={()=>removeRow(row.uid)} style={{color:'#e74c3c', border:'none', background:'none', cursor:'pointer', fontSize:'14px', lineHeight:'1'}}>×</button></td>
                                                    </>
                                                )}
                                            </tr>
                                        );
                                    })}
                                    {!isClientMode && (
                                        <tr style={{ background: '#fff', borderTop: '2px solid #eee' }}>
                                            <td colSpan={2} style={{textAlign:'right', padding:'8px', fontWeight:'bold', color:'#aaa', fontSize:'10px', textTransform:'uppercase'}}>Subtotal ({category.name}):</td>
                                            <td colSpan={7}></td>
                                            <td colSpan={1} style={{textAlign:'right', padding:'8px', fontSize:'10px', color:'#777'}}>Cost: {subTotalCost.toFixed(0)}</td>
                                            <td colSpan={4}></td>
                                            <td style={{textAlign:'right', padding:'8px', fontWeight:'bold', fontSize:'11px'}}>₹{subTotalAmt.toLocaleString('en-IN')}</td>
                                            <td colSpan={2}></td>
                                            <td style={{textAlign:'right', padding:'8px', fontWeight:'bold', color: subTotalGross < 0 ? 'red' : '#27ae60', fontSize:'11px'}}>{subTotalGross.toLocaleString('en-IN')}</td>
                                            <td></td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                        </tbody>
                    </table>

                    <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end' }}>
                        <div style={{ width: '350px', padding:'20px', background:'#f8f9fa', borderRadius:'10px', border:'1px solid #eee' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom:'12px', fontSize:'14px' }}>
                                <span style={{color:'#666'}}>Total Base Amount:</span>
                                <strong style={{color:'#333'}}>₹{grandTotalProjectValue.toLocaleString('en-IN', {minimumFractionDigits: 2})}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom:'15px', paddingBottom:'15px', borderBottom:'1px dashed #ccc', fontSize:'14px' }}>
                                <span style={{color:'#666'}}>GST ({gstPercent}%):</span>
                                <span style={{color:'#333'}}>₹{(grandTotalProjectValue * (gstPercent/100)).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize:'18px', color: '#2c3e50', fontWeight: 'bold' }}>
                                <span>GRAND TOTAL:</span>
                                <span>₹{(grandTotalProjectValue * (1 + gstPercent/100)).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: '40px', borderTop:'1px solid #eee', paddingTop:'15px' }}>
                        <div style={{ fontSize:'11px', color:'#999', textAlign:'center' }}>
                            This quotation is valid for 30 days. Errors and omissions excepted (E&OE).
                        </div>
                    </div>
                </div>
              </div>
          </div>
      </div>
      
      {/* INTERNAL FOOTER */}
      {!isClientMode && (
        <div style={{ position:'fixed', bottom:0, left:0, right:0, background: '#2c3e50', color:'white', padding: '10px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow:'0 -4px 20px rgba(0,0,0,0.1)', zIndex: 999 }}>
          <div style={{display:'flex', gap:'30px'}}>
              <div>
                <div style={{ fontSize: '10px', color: '#95a5a6', fontWeight:'bold', letterSpacing:'1px' }}>TOTAL COST</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold' }}>₹{grandTotalCost.toLocaleString('en-IN', {maximumFractionDigits:0})}</div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#95a5a6', fontWeight:'bold', letterSpacing:'1px' }}>NET PROFIT</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color:'#2ecc71' }}>₹{grandTotalProfit.toLocaleString('en-IN', {maximumFractionDigits:0})}</div>
              </div>
          </div>
          
          <div style={{ textAlign: 'center', display:'flex', gap:'15px', alignItems:'center', background:'rgba(255,255,255,0.1)', padding:'5px 15px', borderRadius:'30px' }}>
             <span style={{ fontSize: '12px', fontWeight:'bold' }}>Avg Margin:</span>
             <input type="number" value={baseMarginPercent.toFixed(2)} onChange={(e) => handleGlobalMarginChange(e.target.value)}
                style={{ width: '50px', textAlign: 'center', background:'transparent', color:'white', border:'none', borderBottom:'1px solid white', padding:'2px', fontWeight:'bold', fontSize:'14px' }} />
             <span style={{ fontSize: '12px' }}>%</span>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10px', color: '#95a5a6', fontWeight:'bold', letterSpacing:'1px' }}>OVERRIDE TOTAL</div>
            <input type="number" value={grandTotalProjectValue.toFixed(0)} onChange={(e) => handleGrandTotalChange(e.target.value)}
              style={{ fontSize: '18px', width: '120px', textAlign: 'right', background:'transparent', color:'white', border:'none', borderBottom:'1px solid #7f8c8d', padding:'0', fontWeight:'bold' }} />
          </div>
        </div>
      )}

    </div>
  );
}