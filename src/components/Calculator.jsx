import { useState, useEffect, useRef } from 'react';
import { productCatalog } from './data';
import html2pdf from 'html2pdf.js';

export default function Calculator() {
  // --- STATE: CALCULATIONS ---
  const [rows, setRows] = useState([]);
  const [grandTotalCost, setGrandTotalCost] = useState(0);
  const [grandTotalProfit, setGrandTotalProfit] = useState(0);
  const [grandProjectValue, setGrandProjectValue] = useState(0);
  const [baseMarginPercent, setBaseMarginPercent] = useState(20); 
  const [gstPercent, setGstPercent] = useState(18); // GST 18%

  // --- STATE: QUOTATION METADATA ---
  const [quoteNo, setQuoteNo] = useState("397");
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().slice(0,10));
  const [buyerName, setBuyerName] = useState("Govt Medical College Hospital Thrissur");
  const [buyerAddress, setBuyerAddress] = useState("Kerala, Code: 32");
  const [paymentTerms, setPaymentTerms] = useState("50% Advance");
  
  // --- VIEW MODES ---
  const [isClientMode, setIsClientMode] = useState(false); 
  const pdfRef = useRef(); 

  // --- SEARCH STATE ---
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef(null);

  // --- 1. ROW MANAGEMENT ---
  const addRow = (productId) => {
    const product = productCatalog.find(p => p.id === parseInt(productId));
    if (!product) return;

    const transPercent = 2; 
    const transCost = product.factoryPrice * (transPercent / 100);
    const workCost = product.fitting + product.saddle + product.work;
    const unitInternalCost = product.factoryPrice + transCost + workCost;
    const defaultPrice = unitInternalCost * (1 + baseMarginPercent / 100);

    const newRow = {
      id: Date.now(),
      name: product.name,
      hsn: "9018",       
      unit: "nos",       
      qty: 1,
      factoryPrice: product.factoryPrice, 
      transPercent: transPercent,         
      workCost: workCost,                 
      quotedUnitPrice: parseFloat(defaultPrice.toFixed(2)), 
    };
    setRows([...rows, newRow]);
    setSearchTerm('');
    setShowDropdown(false);
  };

  const addBlankRow = () => {
    const newRow = {
      id: Date.now(),
      name: "New Item Description",
      hsn: "",
      unit: "nos",
      qty: 1,
      factoryPrice: 0,
      transPercent: 2,
      workCost: 0,
      quotedUnitPrice: 0,
    };
    setRows([...rows, newRow]);
  };

  const removeRow = (id) => {
    setRows(rows.filter(r => r.id !== id));
  };

  const updateRow = (id, field, value) => {
    const updatedRows = rows.map(row => {
      if (row.id === id) {
        let finalVal = value;
        // Keep text fields as text, numbers as numbers
        if (['name', 'hsn', 'unit'].includes(field)) {
            finalVal = value;
        } else {
            if (value === '') { finalVal = ''; } 
            else { finalVal = parseFloat(value); }
        }
        return { ...row, [field]: finalVal };
      }
      return row;
    });
    setRows(updatedRows);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- 2. CALCULATION ENGINE ---
  useEffect(() => {
    let totalCostSum = 0;
    let totalProjectValueSum = 0;

    rows.forEach(row => {
      const safeFactoryPrice = parseFloat(row.factoryPrice) || 0;
      const safeTransPercent = parseFloat(row.transPercent) || 0;
      const safeWorkCost = parseFloat(row.workCost) || 0;
      const safeQty = parseFloat(row.qty) || 0;
      const safeQuotedPrice = parseFloat(row.quotedUnitPrice) || 0;

      const transportAmt = safeFactoryPrice * (safeTransPercent / 100);
      const unitInternalCost = safeFactoryPrice + transportAmt + safeWorkCost;
      
      totalCostSum += unitInternalCost * safeQty;
      totalProjectValueSum += safeQuotedPrice * safeQty;
    });

    setGrandTotalCost(totalCostSum);
    setGrandProjectValue(totalProjectValueSum);
    setGrandTotalProfit(totalProjectValueSum - totalCostSum);

  }, [rows]);

  const handleGlobalValueChange = (newValue) => {
    const newGlobalTotal = parseFloat(newValue) || 0;
    if (grandProjectValue === 0 || rows.length === 0) {
        setGrandProjectValue(newGlobalTotal);
        return;
    }
    const ratio = newGlobalTotal / grandProjectValue;
    const updatedRows = rows.map(row => ({
        ...row,
        quotedUnitPrice: parseFloat((row.quotedUnitPrice * ratio).toFixed(2))
    }));
    setRows(updatedRows);
    
    // Update margin logic
    const newProfit = newGlobalTotal - grandTotalCost;
    if(grandTotalCost > 0) {
        setBaseMarginPercent((newProfit / grandTotalCost) * 100);
    }
  };

  const handleBaseMarginChange = (newVal) => {
    const newMargin = parseFloat(newVal) || 0;
    setBaseMarginPercent(newMargin);

    const updatedRows = rows.map(row => {
        const safeFactoryPrice = parseFloat(row.factoryPrice) || 0;
        const safeTransPercent = parseFloat(row.transPercent) || 0;
        const safeWorkCost = parseFloat(row.workCost) || 0;
        const transportAmt = safeFactoryPrice * (safeTransPercent / 100);
        const unitInternalCost = safeFactoryPrice + transportAmt + safeWorkCost;
        const newPrice = unitInternalCost * (1 + newMargin / 100);
        
        return { ...row, quotedUnitPrice: parseFloat(newPrice.toFixed(2)) };
    });
    setRows(updatedRows);
  };

  // --- 3. PDF GENERATOR ---
  const handleDownloadPDF = () => {
    const wasInClientMode = isClientMode;
    if (!isClientMode) setIsClientMode(true);

    setTimeout(() => {
        const element = pdfRef.current;
        const safeTitle = `Quote_${quoteNo}_${buyerName}`.replace(/[^a-z0-9]/gi, '_');
        const opt = {
          margin: 10,
          filename: `${safeTitle}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
        };

        html2pdf().set(opt).from(element).save().then(() => {
            if (!wasInClientMode) setIsClientMode(false);
        });
    }, 500);
  };

  const filteredProducts = searchTerm.length > 0 
    ? productCatalog.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : [];

  return (
    <div style={{ minWidth: '1300px', margin: '0 auto', fontFamily: 'Arial, sans-serif', paddingBottom: '100px', color: 'black' }}>
      
      <style>{`
        input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        input { font-family: inherit; }
      `}</style>

      {/* --- CONTROLS HEADER (Hidden in PDF) --- */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '15px', background: '#e3f2fd', borderRadius: '8px' }}>
        <div>
            <h3 style={{margin:0, color:'#0d47a1'}}>Quotation Manager</h3>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setIsClientMode(!isClientMode)} style={{ padding: '10px 20px', cursor: 'pointer', background: isClientMode ? '#4caf50' : '#ff9800', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>
            {isClientMode ? "Exit Client Mode" : "Enter Client Mode"}
          </button>
          <button onClick={handleDownloadPDF} style={{ padding: '10px 20px', cursor: 'pointer', background: '#333', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>
            Download PDF
          </button>
        </div>
      </div>

      {/* --- ADD ITEMS BAR (Hidden in Client Mode) --- */}
      {!isClientMode && (
        <div ref={searchRef} style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #ddd', position: 'relative', display:'flex', gap:'10px' }}>
          <div style={{flex: 1, position:'relative'}}>
              <input 
                type="text"
                placeholder="Search Database (e.g. Copper)..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                style={{ width: '100%', padding: '12px', fontSize: '16px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
              {showDropdown && searchTerm.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #ccc', borderRadius: '0 0 8px 8px', maxHeight: '400px', overflowY: 'auto', zIndex: 1000, boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}>
                  {filteredProducts.map(product => (
                    <div key={product.id} onClick={() => addRow(product.id)} style={{ padding: '12px 15px', borderBottom: '1px solid #eee', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }} onMouseEnter={(e) => e.currentTarget.style.background = '#e3f2fd'} onMouseLeave={(e) => e.currentTarget.style.background = 'white'}>
                      <b>{product.name}</b>
                      <span style={{color:'#666'}}>Base: ₹{product.factoryPrice}</span>
                    </div>
                  ))}
                </div>
              )}
          </div>
          <button onClick={addBlankRow} style={{ padding:'0 25px', background:'#007bff', color:'white', border:'none', borderRadius:'4px', fontWeight:'bold', cursor:'pointer' }}>+ Add Blank Row</button>
        </div>
      )}

      {/* --- THE PDF DOCUMENT --- */}
      <div ref={pdfRef} style={{ background: 'white', padding: '40px', color: 'black', maxWidth: isClientMode ? '1000px' : '100%', margin:'0 auto', border:'1px solid #eee' }}>
        
        {/* 1. LETTERHEAD */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom:'2px solid #000', paddingBottom:'20px', marginBottom:'20px' }}>
            <div style={{maxWidth:'60%'}}>
                <h1 style={{ margin: '0 0 5px 0', color: '#0d47a1', textTransform:'uppercase', fontSize:'28px' }}>United Biomedical Services</h1>
                <p style={{ margin: '2px 0', fontSize:'12px', lineHeight:'1.4' }}>
                    21/571-United Building Near Petrol Pump,<br/>
                    6/2 Velliparambu-Po, Medical College Via,<br/>
                    Calicut-673008 | Ph: 0495 2301999, 9388774404<br/>
                    Email: unitedbiomed@gmail.com | Web: Www.Unitedbiomed.Net
                </p>
                <p style={{ margin: '5px 0 0 0', fontWeight:'bold', fontSize:'12px' }}>GST No: 32AABFU7327D1ZI</p>
            </div>
            <div style={{textAlign:'right'}}>
                <h2 style={{margin:'0 0 10px 0', color:'#555'}}>QUOTATION</h2>
                <div style={{fontSize:'14px'}}>
                    <b>Quotation No:</b> 
                    {isClientMode ? <span style={{marginLeft:'5px'}}>{quoteNo}</span> : <input type="text" value={quoteNo} onChange={(e)=>setQuoteNo(e.target.value)} style={{width:'80px', marginLeft:'5px'}} />}
                </div>
                <div style={{fontSize:'14px', marginTop:'5px'}}>
                    <b>Date:</b>
                    {isClientMode ? <span style={{marginLeft:'5px'}}>{quoteDate}</span> : <input type="date" value={quoteDate} onChange={(e)=>setQuoteDate(e.target.value)} style={{width:'110px', marginLeft:'5px'}} />}
                </div>
            </div>
        </div>

        {/* 2. BUYER DETAILS */}
        <div style={{ display:'flex', marginBottom:'30px' }}>
            <div style={{ width:'50%', paddingRight:'20px' }}>
                <div style={{ background:'#eee', padding:'5px 10px', fontWeight:'bold', fontSize:'12px', borderBottom:'1px solid #ccc' }}>BUYER (BILL TO)</div>
                <div style={{ marginTop:'10px' }}>
                    {isClientMode ? <div style={{fontWeight:'bold', fontSize:'16px'}}>{buyerName}</div> : 
                        <input type="text" value={buyerName} onChange={(e)=>setBuyerName(e.target.value)} style={{width:'100%', padding:'5px', fontWeight:'bold'}} placeholder="Client Name" />
                    }
                    {isClientMode ? <div style={{marginTop:'5px', whiteSpace:'pre-wrap'}}>{buyerAddress}</div> : 
                        <textarea value={buyerAddress} onChange={(e)=>setBuyerAddress(e.target.value)} style={{width:'100%', marginTop:'5px', height:'60px'}} placeholder="Address..." />
                    }
                </div>
            </div>
            <div style={{ width:'50%', paddingLeft:'20px' }}>
                <div style={{ background:'#eee', padding:'5px 10px', fontWeight:'bold', fontSize:'12px', borderBottom:'1px solid #ccc' }}>TERMS</div>
                <div style={{ marginTop:'10px', fontSize:'13px' }}>
                    <div style={{display:'flex', marginBottom:'5px'}}>
                        <b style={{width:'100px'}}>Payment:</b>
                        {isClientMode ? <span>{paymentTerms}</span> : <input type="text" value={paymentTerms} onChange={(e)=>setPaymentTerms(e.target.value)} />}
                    </div>
                    <div style={{display:'flex', marginBottom:'5px'}}>
                        <b style={{width:'100px'}}>Delivery:</b>
                        <span>Immediate / As Discussed</span>
                    </div>
                </div>
            </div>
        </div>

        {/* 3. TABLE */}
        <div style={{ minHeight:'400px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', color: 'black', fontSize:'12px' }}>
            <thead>
              <tr style={{ background: '#333', color: 'white', textAlign: 'left' }}>
                <th style={{ padding: '8px', border:'1px solid #000' }}>SI</th>
                <th style={{ padding: '8px', border:'1px solid #000', width:'30%' }}>Description</th>
                <th style={{ padding: '8px', border:'1px solid #000' }}>HSN</th>
                <th style={{ padding: '8px', border:'1px solid #000' }}>Qty</th>
                <th style={{ padding: '8px', border:'1px solid #000' }}>Unit</th>
                
                {/* --- INTERNAL COLUMNS (Hidden in PDF) --- */}
                {!isClientMode && (
                  <>
                    <th style={{ padding: '8px', background:'#e1f5fe', color:'black' }}>Fact.</th>
                    <th style={{ padding: '8px', background:'#e1f5fe', color:'black' }}>Trn%</th>
                    <th style={{ padding: '8px', background:'#e1f5fe', color:'black' }}>TrnAmt</th>
                    <th style={{ padding: '8px', background:'#e1f5fe', color:'black' }}>Work</th>
                    <th style={{ padding: '8px', background:'#90a4ae', color:'white' }}>Int.Cost</th>
                    <th style={{ padding: '8px', background:'#ffcc80', color:'black' }}>Base+{baseMarginPercent.toFixed(0)}%</th>
                  </>
                )}
                
                <th style={{ padding: '8px', border:'1px solid #000', textAlign:'right' }}>Rate</th>
                <th style={{ padding: '8px', border:'1px solid #000', textAlign:'right' }}>Amount</th>
                
                {/* PROFIT COLUMN */}
                {!isClientMode && <th style={{ padding: '8px', background:'#a5d6a7' }}>Profit</th>}
                
                {!isClientMode && <th style={{ padding: '8px' }}></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const safeFactoryPrice = parseFloat(row.factoryPrice) || 0;
                const safeTransPercent = parseFloat(row.transPercent) || 0;
                const safeWorkCost = parseFloat(row.workCost) || 0;
                const safeQty = parseFloat(row.qty) || 0;
                const safeQuotedPrice = parseFloat(row.quotedUnitPrice) || 0;

                const transportAmt = safeFactoryPrice * (safeTransPercent / 100);
                const unitInternalCost = safeFactoryPrice + transportAmt + safeWorkCost;
                const basePriceDynamic = unitInternalCost * (1 + baseMarginPercent / 100);
                const rowFinalTotal = safeQuotedPrice * safeQty;
                const rowProfit = rowFinalTotal - (unitInternalCost * safeQty);

                return (
                  <tr key={row.id}>
                    <td style={{ padding: '8px', border:'1px solid #ccc', textAlign:'center' }}>{index + 1}</td>
                    
                    {/* NAME */}
                    <td style={{ padding: '8px', border:'1px solid #ccc' }}>
                      {isClientMode ? <span>{row.name}</span> : <input type="text" value={row.name} onChange={(e) => updateRow(row.id, 'name', e.target.value)} style={{ width: '100%', border:'none' }} />}
                    </td>

                    {/* HSN */}
                    <td style={{ padding: '8px', border:'1px solid #ccc' }}>
                      {isClientMode ? <span>{row.hsn}</span> : <input type="text" value={row.hsn} onChange={(e) => updateRow(row.id, 'hsn', e.target.value)} style={{ width: '50px', border:'none' }} />}
                    </td>

                    {/* QTY */}
                    <td style={{ padding: '8px', border:'1px solid #ccc', textAlign:'center' }}>
                      {isClientMode ? <span>{row.qty}</span> : <input type="number" value={row.qty} onChange={(e) => updateRow(row.id, 'qty', e.target.value)} style={{ width: '40px', border:'none', textAlign:'center' }} />}
                    </td>

                    {/* UNIT */}
                    <td style={{ padding: '8px', border:'1px solid #ccc' }}>
                      {isClientMode ? <span>{row.unit}</span> : <input type="text" value={row.unit} onChange={(e) => updateRow(row.id, 'unit', e.target.value)} style={{ width: '40px', border:'none' }} />}
                    </td>
                    
                    {/* INTERNAL COLUMNS */}
                    {!isClientMode && (
                        <>
                            <td style={{ padding: '5px', background:'#f0fbff' }}><input type="number" value={row.factoryPrice} onChange={(e) => updateRow(row.id, 'factoryPrice', e.target.value)} style={{width:'50px'}} /></td>
                            <td style={{ padding: '5px', background:'#f0fbff' }}><input type="number" value={row.transPercent} onChange={(e) => updateRow(row.id, 'transPercent', e.target.value)} style={{width:'30px'}} /></td>
                            <td style={{ padding: '5px', color:'#777' }}>{transportAmt.toFixed(0)}</td>
                            <td style={{ padding: '5px', background:'#f0fbff' }}><input type="number" value={row.workCost} onChange={(e) => updateRow(row.id, 'workCost', e.target.value)} style={{width:'40px'}} /></td>
                            <td style={{ padding: '5px', background:'#cfd8dc', fontWeight:'bold' }}>{unitInternalCost.toFixed(0)}</td>
                            <td style={{ padding: '5px', background:'#ffe0b2', fontWeight:'bold' }}>{basePriceDynamic.toFixed(0)}</td>
                        </>
                    )}
                    
                    {/* RATE */}
                    <td style={{ padding: '8px', border:'1px solid #ccc', textAlign:'right' }}>
                      {isClientMode ? <span>{safeQuotedPrice.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span> : 
                        <input type="number" value={row.quotedUnitPrice} onChange={(e) => updateRow(row.id, 'quotedUnitPrice', e.target.value)} style={{ width: '70px', textAlign:'right', border:'none', fontWeight:'bold', color:'#0d47a1' }} />
                      }
                    </td>

                    {/* AMOUNT */}
                    <td style={{ padding: '8px', border:'1px solid #ccc', textAlign:'right', fontWeight:'bold' }}>
                      {rowFinalTotal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </td>
                    
                    {/* PROFIT */}
                    {!isClientMode && (
                        <td style={{ padding: '8px', background:'#e8f5e9', color: rowProfit < 0 ? 'red' : 'green', fontWeight:'bold' }}>
                            {rowProfit.toLocaleString('en-IN', {maximumFractionDigits:0})}
                        </td>
                    )}

                    {!isClientMode && <td style={{border:'none'}}><button onClick={() => removeRow(row.id)} style={{ color: 'red' }}>×</button></td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 4. TOTALS & FOOTER */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
            <div style={{ width: '40%' }}>
                <div style={{ display:'flex', justifyContent:'space-between', padding:'5px', borderBottom:'1px solid #eee' }}>
                    <span>Total Amount:</span>
                    <span>₹{grandProjectValue.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                </div>
                
                {/* GST CALCULATION */}
                <div style={{ display:'flex', justifyContent:'space-between', padding:'5px', borderBottom:'1px solid #eee' }}>
                    <span>
                        GST ({isClientMode ? `${gstPercent}%` : <input type="number" value={gstPercent} onChange={(e)=>setGstPercent(e.target.value)} style={{width:'30px'}} />})
                        :
                    </span>
                    <span>₹{(grandProjectValue * (gstPercent/100)).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                </div>

                <div style={{ display:'flex', justifyContent:'space-between', padding:'10px', background:'#eee', fontWeight:'bold', marginTop:'5px' }}>
                    <span>GRAND TOTAL:</span>
                    <span>₹{(grandProjectValue * (1 + gstPercent/100)).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                </div>
                
                <div style={{ marginTop: '40px', textAlign: 'center' }}>
                    <div style={{ marginBottom: '40px' }}>For United Biomedical Services</div>
                    <div style={{ borderTop: '1px solid #000', width: '80%', margin: '0 auto' }}>Authorized Signatory</div>
                </div>
            </div>
        </div>

      </div>

      {/* INTERNAL CONTROLS (Floating Footer) */}
      {!isClientMode && (
        <div style={{ position:'fixed', bottom:0, left:0, right:0, background: '#333', color:'white', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '12px', color: '#aaa' }}>INTERNAL COST</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>₹{grandTotalCost.toLocaleString('en-IN')}</div>
          </div>
          
          <div style={{ textAlign: 'center', borderLeft:'1px solid #555', borderRight:'1px solid #555', padding:'0 20px' }}>
            <div style={{ fontSize: '12px', color: '#aaa' }}>BASE MARGIN %</div>
            <input 
                type="number" 
                value={baseMarginPercent} 
                onChange={(e) => handleBaseMarginChange(e.target.value)}
                style={{ fontSize: '20px', width: '60px', textAlign: 'center', background:'black', color:'white', border:'1px solid #555' }}
            />
            <div style={{fontSize:'11px', color:grandTotalProfit > 0 ? '#4caf50' : 'red'}}>Profit: ₹{grandTotalProfit.toLocaleString('en-IN')}</div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12px', color: '#aaa' }}>OVERRIDE SUB-TOTAL</div>
            <input 
              type="number" 
              value={grandProjectValue.toFixed(2)} 
              onChange={(e) => handleGlobalValueChange(e.target.value)}
              style={{ fontSize: '20px', width: '150px', textAlign: 'right', background:'white', color:'black', border:'none', padding:'2px 5px' }}
            />
          </div>
        </div>
      )}

    </div>
  );
}