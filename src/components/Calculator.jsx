import { useState, useEffect, useRef } from 'react';
import { productCatalog } from './data';
import html2pdf from 'html2pdf.js';

export default function Calculator() {
  // --- STATE ---
  const [rows, setRows] = useState([]); 
  const [categoryOrder, setCategoryOrder] = useState([]); 
  
  // GLOBAL DRIVERS
  const [copperRate, setCopperRate] = useState(1270); 
  const [baseMarginPercent, setBaseMarginPercent] = useState(20);
  
  // TOTALS
  const [grandTotalCost, setGrandTotalCost] = useState(0);
  const [grandTotalProjectValue, setGrandTotalProjectValue] = useState(0);
  const [grandTotalProfit, setGrandTotalProfit] = useState(0);
  const [gstPercent, setGstPercent] = useState(18);

  // META
  const [quoteNo, setQuoteNo] = useState("397");
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().slice(0,10));
  const [buyerName, setBuyerName] = useState("Govt Medical College Hospital Thrissur");
  const [buyerAddress, setBuyerAddress] = useState("Kerala, Code: 32");
  
  const [isClientMode, setIsClientMode] = useState(false);
  const pdfRef = useRef();

  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef(null);

  // --- CALCULATION ENGINE ---
  const calculateRow = (row, overrideMargin = null) => {
    // 1. Determine Margin %
    const marginPct = overrideMargin !== null ? overrideMargin : row.marginPercent;
    
    // 2. Costs
    const transAmt = row.factoryPrice * (row.transPercent / 100);
    // "Total Per Unit" (Internal Cost) = Charge with everything
    const internalCost = row.factoryPrice + transAmt + row.fittingCost + row.saddleCost + row.workCost;
    
    // 3. Margin Amount (Target)
    const marginAmt = internalCost * (marginPct / 100);
    
    // 4. Quoted Price
    // If we are just recalculating based on margin, Price = Cost + Margin
    // However, if the user Manually Edited the Price, we might want to keep it?
    // For this helper, we assume we are driving from Margin.
    // NOTE: In updateRow, we handle the reverse case (Price -> Margin).
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
  };

  const removeRow = (uid) => setRows(rows.filter(r => r.uid !== uid));

  const updateRow = (uid, field, value) => {
    const val = value === '' ? 0 : parseFloat(value);
    
    setRows(rows.map(row => {
        if (row.uid !== uid) return row;
        
        const updated = { ...row, [field]: val };

        // 1. If Factory Price changes, recalculate everything
        if (field === 'factoryPrice') {
             // Logic handled by calculateRow at bottom
        }
        // 2. If Transport Amount changes, update %
        else if (field === 'transAmt') {
             updated.transPercent = row.factoryPrice > 0 ? (val / row.factoryPrice) * 100 : 0;
        }
        // 3. If Added Margin Amount changes, update % and Price
        else if (field === 'marginAmt') {
             const cost = row.internalCost;
             updated.marginPercent = cost > 0 ? (val / cost) * 100 : 0;
             updated.quotedPrice = cost + val;
             return { ...updated, marginAmt: val }; // Return early to avoid overwrite
        }
        // 4. If Quoted Price changes (Manual Override), update Margins
        else if (field === 'quotedPrice') {
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
          
          return { 
              ...row, 
              quotedPrice: newRate, 
              marginAmt: newMarginAmt, 
              marginPercent: newMarginPercent 
          };
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

  // --- EFFECTS ---
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

  const handleDownloadPDF = () => {
    setIsClientMode(true);
    setTimeout(() => {
        const element = pdfRef.current;
        html2pdf().set({ margin: 5, filename: `Quote_${quoteNo}.pdf`, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4' } }).from(element).save()
        .then(() => setIsClientMode(false));
    }, 500);
  };

  // --- STYLES ---
  const inputStyle = { width: '100%', border: '1px solid #cce5ff', background: '#f0f8ff', padding: '4px', borderRadius: '4px', textAlign:'right', fontSize:'11px' };
  const readOnlyStyle = { width: '100%', border: 'none', background: 'transparent', textAlign:'right', color:'#555', fontWeight:'500', fontSize:'11px' };
  const headerStyle = { background: '#343a40', color: 'white', textAlign: 'center', fontSize:'11px', padding:'5px 2px' };

  return (
    <div style={{ fontFamily: 'Segoe UI, Roboto, Helvetica, Arial, sans-serif', padding: '20px', minWidth: '1500px', backgroundColor: '#e9ecef', paddingBottom:'150px' }}>
      
      {/* HEADER BAR */}
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems:'center', background: 'white', padding: '15px 20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <h2 style={{ margin: 0, color: '#2c3e50' }}>Quotation Manager</h2>
        
        {!isClientMode && (
             <div style={{ display: 'flex', alignItems: 'center', background: '#fff3cd', padding: '5px 15px', borderRadius: '20px', border:'1px solid #ffeeba' }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#856404', marginRight: '10px' }}>Copper Market Rate:</span>
                <input 
                    type="number" 
                    value={copperRate} 
                    onChange={(e) => handleCopperRateChange(e.target.value)}
                    style={{ width: '80px', padding: '5px', borderRadius: '4px', border: '1px solid #ccc', textAlign: 'center', fontWeight:'bold' }}
                />
            </div>
        )}

        <div style={{display:'flex', gap:'10px'}}>
            <button onClick={() => setIsClientMode(!isClientMode)} style={{ padding: '8px 20px', background: isClientMode ? '#28a745' : '#6c757d', color:'white', border: 'none', borderRadius: '4px', cursor:'pointer', fontWeight:'bold' }}>
                {isClientMode ? "Exit Client Mode" : "Client Mode"}
            </button>
            <button onClick={handleDownloadPDF} style={{ padding: '8px 20px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor:'pointer', fontWeight:'bold' }}>
                Download PDF
            </button>
        </div>
      </div>

      {/* SEARCH BAR */}
      {!isClientMode && (
        <div ref={searchRef} style={{ position: 'relative', marginBottom: '20px' }}>
            <input 
                type="text" 
                placeholder="Search Item to Add..." 
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setShowDropdown(true); }}
                style={{ width: '100%', padding: '15px', borderRadius: '8px', border: '1px solid #ced4da', fontSize: '16px' }}
            />
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

      {/* --- MAIN SHEET --- */}
      <div ref={pdfRef} style={{ background: 'white', padding: '40px', borderRadius: '8px', boxShadow: '0 5px 30px rgba(0,0,0,0.05)', minHeight: '800px' }}>
        
        {/* LETTERHEAD */}
        <div style={{ borderBottom: '2px solid #2c3e50', paddingBottom: '20px', marginBottom: '30px', display: 'flex', justifyContent: 'space-between' }}>
            <div>
                <h1 style={{ margin: '0 0 5px 0', color: '#0056b3', fontSize: '26px' }}>UNITED BIOMEDICAL SERVICES</h1>
                <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>Ph: 0495 2301999 | Email: unitedbiomed@gmail.com</p>
            </div>
            <div style={{ textAlign: 'right' }}>
                <h2 style={{ margin: '0 0 10px 0', color: '#444' }}>QUOTATION</h2>
                <div style={{ fontSize: '14px' }}>No: <input value={quoteNo} onChange={e => setQuoteNo(e.target.value)} style={{ border: 'none', borderBottom: '1px solid #ccc', textAlign: 'right', width: '80px' }} /></div>
                <div style={{ fontSize: '14px' }}>Date: <input type="date" value={quoteDate} onChange={e => setQuoteDate(e.target.value)} style={{ border: 'none', borderBottom: '1px solid #ccc', textAlign: 'right' }} /></div>
            </div>
        </div>

        {/* CUSTOMER BLOCK */}
        <div style={{ marginBottom: '40px', background:'#f8f9fa', padding:'20px', borderRadius:'6px' }}>
            <label style={{ display:'block', marginBottom:'8px', fontSize:'11px', fontWeight:'bold', color:'#888' }}>BILL TO CLIENT</label>
            <input value={buyerName} onChange={e => setBuyerName(e.target.value)} style={{ width: '100%', fontWeight: 'bold', fontSize: '18px', border: 'none', background:'transparent', borderBottom:'1px solid #ddd' }} />
            <textarea value={buyerAddress} onChange={e => setBuyerAddress(e.target.value)} style={{ width: '100%', border: 'none', background:'transparent', height: '40px', resize:'none' }} />
        </div>

        {/* --- DATA TABLE --- */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
                <tr style={{height:'35px'}}>
                    <th style={{...headerStyle, width:'30px'}}>#</th>
                    <th style={{...headerStyle, textAlign:'left', paddingLeft:'10px'}}>Item Description</th>
                    {!isClientMode && (
                        <>
                            <th style={{...headerStyle, width:'60px', background:'#495057'}}>Fact.</th>
                            <th style={{...headerStyle, width:'40px', background:'#495057'}}>Trn%</th>
                            <th style={{...headerStyle, width:'50px', background:'#495057'}}>Trn.₹</th>
                            <th style={{...headerStyle, width:'40px'}}>Fit</th>
                            <th style={{...headerStyle, width:'40px'}}>Sadl</th>
                            <th style={{...headerStyle, width:'40px'}}>Work</th>
                            <th style={{...headerStyle, width:'60px', background:'#6c757d'}}>Total Cost</th>
                            <th style={{...headerStyle, width:'40px', background:'#adb5bd', color:'black'}}>Mrg%</th>
                            <th style={{...headerStyle, width:'50px', background:'#adb5bd', color:'black'}}>Mrg.₹</th>
                        </>
                    )}
                    <th style={{...headerStyle, width:'50px'}}>Qty</th>
                    <th style={{...headerStyle, width:'40px'}}>Unit</th>
                    <th style={{...headerStyle, width:'80px'}}>Rate</th>
                    <th style={{...headerStyle, width:'90px'}}>Amount</th>
                    {!isClientMode && (
                        <>
                            <th style={{...headerStyle, width:'60px', background:'#198754'}}>Pft.Marg</th>
                            <th style={{...headerStyle, width:'50px', background:'#198754'}}>Pft.%</th>
                            <th style={{...headerStyle, width:'70px', background:'#157347'}}>Tot.Gross</th>
                            <th style={{...headerStyle, width:'30px', background:'#fff', color:'red'}}></th>
                        </>
                    )}
                </tr>
            </thead>
            
            <tbody>
            {categoryOrder.map((catId, catIndex) => {
                const category = productCatalog.find(c => c.id === catId);
                const catRows = rows.filter(r => r.categoryId === catId);
                
                // SUBSECTION TOTALS
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
                            <td colSpan={isClientMode ? 5 : 18} style={{ padding: '8px 10px', fontWeight: 'bold', color:'#333', borderBottom:'1px solid #dee2e6' }}>
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
                            // Row calculations for display
                            const actualProfit = row.quotedPrice - row.internalCost;
                            const actualProfitPercent = row.internalCost > 0 ? (actualProfit / row.internalCost) * 100 : 0;
                            const totalGross = actualProfit * row.qty;

                            return (
                                <tr key={row.uid} style={{ borderBottom: '1px solid #f1f1f1' }}>
                                    <td style={{ textAlign: 'center', padding:'5px' }}>{index + 1}</td>
                                    <td style={{ padding:'5px' }}>{row.name}</td>
                                    
                                    {!isClientMode && (
                                        <>
                                            <td style={{padding:'2px'}}><input type="number" value={row.factoryPrice.toFixed(2)} onChange={(e)=>updateRow(row.uid, 'factoryPrice', e.target.value)} style={inputStyle} /></td>
                                            <td style={{padding:'2px'}}><input type="number" value={row.transPercent} onChange={(e)=>updateRow(row.uid, 'transPercent', e.target.value)} style={inputStyle} /></td>
                                            <td style={{padding:'2px'}}><input type="number" value={row.transAmt.toFixed(2)} onChange={(e)=>updateRow(row.uid, 'transAmt', e.target.value)} style={readOnlyStyle} tabIndex="-1" /></td>
                                            <td style={{padding:'2px'}}><input type="number" value={row.fittingCost} onChange={(e)=>updateRow(row.uid, 'fittingCost', e.target.value)} style={inputStyle} /></td>
                                            <td style={{padding:'2px'}}><input type="number" value={row.saddleCost} onChange={(e)=>updateRow(row.uid, 'saddleCost', e.target.value)} style={inputStyle} /></td>
                                            <td style={{padding:'2px'}}><input type="number" value={row.workCost} onChange={(e)=>updateRow(row.uid, 'workCost', e.target.value)} style={inputStyle} /></td>
                                            <td style={{padding:'2px', fontWeight:'bold', color:'#666', textAlign:'right'}}>{row.internalCost.toFixed(0)}</td>
                                            <td style={{padding:'2px'}}><input type="number" value={row.marginPercent.toFixed(2)} onChange={(e)=>updateRow(row.uid, 'marginPercent', e.target.value)} style={{...inputStyle, background:'#fff3cd', border:'1px solid #ffeeba'}} /></td>
                                            <td style={{padding:'2px'}}><input type="number" value={row.marginAmt.toFixed(2)} onChange={(e)=>updateRow(row.uid, 'marginAmt', e.target.value)} style={inputStyle} /></td>
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

        {/* GRAND TOTALS */}
        <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ width: '300px', padding:'20px', background:'#f8f9fa', borderRadius:'8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom:'10px' }}>
                    <span style={{color:'#666'}}>Sub Total:</span>
                    <strong>₹{grandTotalProjectValue.toLocaleString('en-IN', {minimumFractionDigits: 2})}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom:'10px', paddingBottom:'10px', borderBottom:'1px solid #ddd' }}>
                    <span style={{color:'#666'}}>GST ({gstPercent}%):</span>
                    <span>₹{(grandTotalProjectValue * (gstPercent/100)).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize:'18px', color: '#0056b3', fontWeight: 'bold' }}>
                    <span>GRAND TOTAL:</span>
                    <span>₹{(grandTotalProjectValue * (1 + gstPercent/100)).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                </div>
            </div>
        </div>
      </div>

      {/* FOOTER BAR */}
      {!isClientMode && (
        <div style={{ position:'fixed', bottom:0, left:0, right:0, background: '#343a40', color:'white', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow:'0 -2px 10px rgba(0,0,0,0.1)', zIndex: 999 }}>
          <div>
            <div style={{ fontSize: '11px', color: '#adb5bd' }}>INTERNAL COST</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>₹{grandTotalCost.toLocaleString('en-IN', {maximumFractionDigits:0})}</div>
          </div>
          
          <div style={{ textAlign: 'center', display:'flex', gap:'20px', alignItems:'center' }}>
             <div>
                 <div style={{ fontSize: '11px', color: '#adb5bd' }}>AVG MARGIN %</div>
                 <input 
                    type="number" 
                    value={baseMarginPercent.toFixed(2)} 
                    onChange={(e) => handleGlobalMarginChange(e.target.value)}
                    style={{ width: '60px', textAlign: 'center', background:'#495057', color:'white', border:'none', padding:'5px', borderRadius:'4px', fontWeight:'bold' }}
                />
             </div>
             <div>
                <div style={{ fontSize: '11px', color: '#adb5bd' }}>NET PROFIT</div>
                <div style={{ fontSize: '16px', color: '#28a745', fontWeight:'bold' }}>₹{grandTotalProfit.toLocaleString('en-IN', {maximumFractionDigits:0})}</div>
             </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: '#adb5bd' }}>OVERRIDE TOTAL VALUE</div>
            <input 
              type="number" 
              value={grandTotalProjectValue.toFixed(0)} 
              onChange={(e) => handleGrandTotalChange(e.target.value)}
              style={{ fontSize: '20px', width: '140px', textAlign: 'right', background:'white', color:'black', border:'none', padding:'4px 8px', borderRadius:'4px', fontWeight:'bold' }}
            />
          </div>
        </div>
      )}

    </div>
  );
}