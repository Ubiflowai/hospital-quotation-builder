import { useState, useEffect, useRef } from 'react';
import { productCatalog } from './data';
import html2pdf from 'html2pdf.js';

export default function Calculator() {
  // --- STATE ---
  const [rows, setRows] = useState([]);
  const [grandTotalCost, setGrandTotalCost] = useState(0);
  const [grandTotalProfit, setGrandTotalProfit] = useState(0);
  const [grandProjectValue, setGrandProjectValue] = useState(0);
  const [realizedMargin, setRealizedMargin] = useState(0);
  const [quoteTitle, setQuoteTitle] = useState("New Project Quotation");

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

    // Initial Calculations
    const transPercent = 2; 
    const transCost = product.factoryPrice * (transPercent / 100);
    const workCost = product.fitting + product.saddle + product.work;
    const unitInternalCost = product.factoryPrice + transCost + workCost;
    const defaultPrice = unitInternalCost * 1.20; 

    const newRow = {
      id: Date.now(),
      name: product.name,
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

  // --- FIXED UPDATE FUNCTION (Prevents Cursor Jumping) ---
  const updateRow = (id, field, value) => {
    const updatedRows = rows.map(row => {
      if (row.id === id) {
        // We store exactly what you type (string), so decimals/zeros don't get eaten
        return { ...row, [field]: value };
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
      // Convert strings to numbers ONLY for math (safely)
      const safeFactoryPrice = parseFloat(row.factoryPrice) || 0;
      const safeTransPercent = parseFloat(row.transPercent) || 0;
      const safeWorkCost = parseFloat(row.workCost) || 0;
      const safeQty = parseFloat(row.qty) || 0;
      const safeQuotedPrice = parseFloat(row.quotedUnitPrice) || 0;

      const transportAmt = safeFactoryPrice * (safeTransPercent / 100);
      const unitInternalCost = safeFactoryPrice + transportAmt + safeWorkCost;
      
      totalCostSum += unitInternalCost * safeQty;

      const rowFinalTotal = safeQuotedPrice * safeQty;
      totalProjectValueSum += rowFinalTotal;
    });

    setGrandTotalCost(totalCostSum);
    setGrandProjectValue(totalProjectValueSum);

    const profit = totalProjectValueSum - totalCostSum;
    setGrandTotalProfit(profit);

    if (totalProjectValueSum > 0) {
      setRealizedMargin((profit / totalProjectValueSum) * 100);
    } else {
      setRealizedMargin(0);
    }
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
  };

  // --- 3. PDF GENERATOR ---
  const handleDownloadPDF = () => {
    const wasInClientMode = isClientMode;
    if (!isClientMode) setIsClientMode(true);

    setTimeout(() => {
        const element = pdfRef.current;
        const safeTitle = quoteTitle.replace(/[^a-z0-9]/gi, '_');
        const opt = {
          margin: 5,
          filename: `${safeTitle}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
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
        input::-webkit-outer-spin-button,
        input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>

      {/* TOP BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '15px', background: '#e3f2fd', borderRadius: '8px' }}>
        <div style={{display:'flex', flexDirection:'column', gap:'5px'}}>
            <label style={{fontSize:'12px', fontWeight:'bold', color:'#0d47a1'}}>QUOTATION TITLE</label>
            <input 
                type="text" 
                value={quoteTitle}
                onChange={(e) => setQuoteTitle(e.target.value)}
                style={{ fontSize:'20px', padding:'8px', fontWeight:'bold', border:'1px solid #0d47a1', borderRadius:'4px', width:'350px' }}
            />
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

      {/* INPUT SECTION */}
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

          <button 
            onClick={addBlankRow}
            style={{ padding:'0 25px', background:'#007bff', color:'white', border:'none', borderRadius:'4px', fontWeight:'bold', cursor:'pointer' }}
          >
            + Add Blank Row
          </button>

        </div>
      )}

      {/* --- PRINTABLE AREA --- */}
      <div ref={pdfRef} style={{ background: 'white', padding: '20px', color: 'black' }}>
        
        <div style={{ marginBottom: '20px', borderBottom: '2px solid #0d47a1', paddingBottom: '10px', display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
          <div>
            <h1 style={{ margin: 0, color: 'black', textTransform:'uppercase' }}>{quoteTitle}</h1>
            <p style={{ margin: '5px 0', color: '#000' }}>Date: {new Date().toLocaleDateString()}</p>
          </div>
          <div style={{textAlign:'right'}}>
             <h3 style={{margin:0, color:'#0d47a1'}}>QUOTATION</h3>
          </div>
        </div>

        <div style={{ background: 'white', padding: '0', borderRadius: '8px', border: isClientMode ? 'none' : '1px solid #ccc' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', color: 'black' }}>
            <thead>
              <tr style={{ background: '#333', color: 'white', textAlign: 'left', fontSize: '12px' }}>
                <th style={{ padding: '10px', width: '25%' }}>Description</th>
                <th style={{ padding: '10px', width: '50px' }}>Qty</th>
                
                {!isClientMode && (
                  <>
                    <th style={{ padding: '10px', width: '70px', background:'#e1f5fe', color:'#01579b', borderLeft:'1px solid #ccc' }}>Fact. Price</th>
                    <th style={{ padding: '10px', width: '50px', background:'#e1f5fe', color:'#01579b' }}>Trns %</th>
                    <th style={{ padding: '10px', width: '60px', color:'#bbb' }}>Trn Amt</th>
                    <th style={{ padding: '10px', width: '60px', background:'#e1f5fe', color:'#01579b' }}>Work</th>
                    <th style={{ padding: '10px', width: '70px', background: '#555' }}>Int.Cost</th>
                    <th style={{ padding: '10px', width: '70px', background: '#e0e0e0', color: '#333', borderLeft:'1px solid #999' }}>Base+20%</th>
                  </>
                )}
                
                <th style={{ padding: '10px', width: '100px', background: '#007bff' }}>Unit Price (₹)</th>
                <th style={{ padding: '10px', width: '100px', background: '#0056b3', fontWeight: 'bold' }}>Total (₹)</th>
                {!isClientMode && <th style={{ padding: '10px', width: '30px' }}></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                // Safety Checks for calculations
                const safeFactoryPrice = parseFloat(row.factoryPrice) || 0;
                const safeTransPercent = parseFloat(row.transPercent) || 0;
                const safeWorkCost = parseFloat(row.workCost) || 0;
                const safeQty = parseFloat(row.qty) || 0;
                const safeQuotedPrice = parseFloat(row.quotedUnitPrice) || 0;

                const transportAmt = safeFactoryPrice * (safeTransPercent / 100);
                const unitInternalCost = safeFactoryPrice + transportAmt + safeWorkCost;
                const basePricePlus20 = unitInternalCost * 1.20;
                const rowFinalTotal = safeQuotedPrice * safeQty;

                return (
                  <tr key={row.id} style={{ borderBottom: '1px solid #eee' }}>
                    
                    {/* DESCRIPTION */}
                    <td style={{ padding: '10px', fontSize: '14px' }}>
                      {isClientMode ? (
                        <span style={{color: 'black'}}>{row.name}</span>
                      ) : (
                        <input 
                          type="text" 
                          value={row.name} 
                          onChange={(e) => updateRow(row.id, 'name', e.target.value)}
                          style={{ width: '100%', border: '1px solid #ccc', padding: '5px' }}
                        />
                      )}
                    </td>

                    {/* QTY */}
                    <td style={{ padding: '10px' }}>
                      {isClientMode ? (
                        <span style={{fontWeight:'bold'}}>{row.qty}</span>
                      ) : (
                        <input type="number" value={row.qty} onChange={(e) => updateRow(row.id, 'qty', e.target.value)} 
                          style={{ width: '50px', fontWeight: 'bold', textAlign:'center', border:'1px solid #ccc' }} />
                      )}
                    </td>
                    
                    {/* INTERNAL DATA (Editable!) */}
                    {!isClientMode && (
                      <>
                        <td style={{ padding: '10px', background:'#f0fbff', borderLeft:'1px solid #eee' }}>
                            <input type="number" value={row.factoryPrice} onChange={(e) => updateRow(row.id, 'factoryPrice', e.target.value)} 
                            style={{ width: '60px', background:'white', border:'1px solid #81d4fa', padding:'4px' }} />
                        </td>
                        
                        <td style={{ padding: '10px', background:'#f0fbff' }}>
                            <input type="number" value={row.transPercent} onChange={(e) => updateRow(row.id, 'transPercent', e.target.value)} 
                            style={{ width: '40px', background:'white', border:'1px solid #81d4fa', padding:'4px', textAlign:'center' }} />
                        </td>

                        <td style={{ padding: '10px', color:'#999', fontSize:'12px' }}>{transportAmt.toFixed(0)}</td>
                        
                        <td style={{ padding: '10px', background:'#f0fbff' }}>
                            <input type="number" value={row.workCost} onChange={(e) => updateRow(row.id, 'workCost', e.target.value)} 
                            style={{ width: '50px', background:'white', border:'1px solid #81d4fa', padding:'4px' }} />
                        </td>

                        <td style={{ padding: '10px', background: '#f9f9f9', color:'#555' }}>{unitInternalCost.toFixed(0)}</td>
                        <td style={{ padding: '10px', background: '#fff3e0', fontWeight: 'bold', color: '#e65100', borderLeft:'1px solid #eee' }}>
                          {basePricePlus20.toFixed(0)}
                        </td>
                      </>
                    )}
                    
                    {/* QUOTED PRICE */}
                    <td style={{ padding: '10px' }}>
                      {isClientMode ? (
                        <span>₹{safeQuotedPrice.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                      ) : (
                        <input type="number" value={row.quotedUnitPrice} onChange={(e) => updateRow(row.id, 'quotedUnitPrice', e.target.value)}
                          style={{ width: '90px', padding:'5px', fontWeight: 'bold', color: '#007bff', border: '1px solid #007bff', borderRadius: '4px' }} 
                        />
                      )}
                    </td>

                    <td style={{ padding: '10px', fontWeight: 'bold', color: '#0056b3', fontSize:'15px' }}>
                      ₹{rowFinalTotal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </td>
                    
                    {!isClientMode && (
                      <td>
                        <button onClick={() => removeRow(row.id)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && <div style={{padding:'30px', textAlign:'center', color:'#888'}}>Search or Add Blank Row to begin.</div>}
        </div>

        {/* FOOTER */}
        <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ textAlign: 'right', borderTop: '2px solid #333', paddingTop: '10px' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#0056b3' }}>TOTAL PROJECT VALUE</div>
            <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#0056b3' }}>
              ₹{grandProjectValue.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </div>
          </div>
        </div>

      </div>

      {/* INTERNAL CONTROLS */}
      {!isClientMode && (
        <div style={{ marginTop: '30px', background: '#f1f1f1', padding: '25px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #ccc' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#666' }}>TOTAL INTERNAL COST</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#555' }}>₹{grandTotalCost.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#28a745' }}>REALIZED MARGIN</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#28a745' }}>{realizedMargin.toFixed(1)}%</div>
            <div style={{ fontSize: '14px', color: '#28a745' }}>Profit: ₹{grandTotalProfit.toLocaleString('en-IN', {maximumFractionDigits:0})}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#0056b3' }}>GLOBAL PRICE OVERRIDE</div>
            <input 
              type="number" 
              value={grandProjectValue.toFixed(2)} 
              onChange={(e) => handleGlobalValueChange(e.target.value)}
              style={{ fontSize: '24px', padding: '5px', width: '200px', textAlign: 'right', border: '2px solid #0056b3', borderRadius: '4px' }}
            />
          </div>
        </div>
      )}

    </div>
  );
}