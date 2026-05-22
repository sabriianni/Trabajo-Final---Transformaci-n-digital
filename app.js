// Dashboard Application Logic for Complejo Las Lechuzas
document.addEventListener("DOMContentLoaded", () => {
    // 1. Check Data Load
    if (typeof BOOKINGS_DATA === "undefined") {
        console.error("BOOKINGS_DATA not loaded from data.js");
        return;
    }

    // 2. Global State
    let currentDestination = "all";
    let activeTab = "dashboard-tab";
    let commissionConversionRate = 20; // default 20%
    
    // Reservations Table State
    let tableData = [...BOOKINGS_DATA];
    let filteredTableData = [...BOOKINGS_DATA];
    let currentPage = 1;
    const rowsPerPage = 10;
    let currentSortColumn = "id_reserva";
    let currentSortDirection = "asc"; // 'asc' or 'desc'

    // Chart Instances Store
    let charts = {
        revenueTime: null,
        channels: null,
        occupancyDest: null,
        roomType: null
    };

    // 3. Elements Selection
    const tabs = document.querySelectorAll(".nav-item");
    const tabContents = document.querySelectorAll(".tab-content");
    const destinationBtns = document.querySelectorAll("#destination-filters-container .filter-btn");
    
    // KPI elements
    const kpiTotalBookings = document.getElementById("kpi-total-bookings");
    const kpiTotalNights = document.getElementById("kpi-total-nights");
    const kpiTotalRevenue = document.getElementById("kpi-total-revenue");
    const kpiAdr = document.getElementById("kpi-adr");
    const kpiAvgOccupancy = document.getElementById("kpi-avg-occupancy");
    const kpiOccupancyTrend = document.getElementById("kpi-occupancy-trend");
    const kpiTotalCommissions = document.getElementById("kpi-total-commissions");
    const kpiCommissionRatio = document.getElementById("kpi-commission-ratio");

    // Simulator elements
    const conversionSlider = document.getElementById("conversion-slider");
    const sliderPercentageVal = document.getElementById("slider-percentage-val");
    const simSavings = document.getElementById("sim-savings");
    const simProfitPct = document.getElementById("sim-profit-pct");

    // Table elements
    const tableBody = document.getElementById("table-body");
    const tableShowingText = document.getElementById("table-showing-text");
    const paginationContainer = document.getElementById("pagination-container");
    const searchInput = document.getElementById("search-input");
    const filterDestination = document.getElementById("filter-destination");
    const filterChannel = document.getElementById("filter-channel");
    const btnExportCsv = document.getElementById("btn-export-csv");
    const tableHeaders = document.querySelectorAll("#bookings-table th.sortable");

    // AI Alerts container
    const alertsContainer = document.getElementById("alerts-container");

    // 4. Formatting Utilities
    const formatCurrency = (value) => {
        return new Intl.NumberFormat("es-AR", {
            style: "currency",
            currency: "ARS",
            maximumFractionDigits: 0
        }).format(value);
    };

    const formatPercent = (value) => {
        return `${value.toFixed(1)}%`;
    };

    // 5. Calculate and Aggregate Metrics
    const calculateMetrics = (data) => {
        const totalBookings = data.length;
        const totalNights = data.reduce((sum, b) => sum + b.cantidad_noches, 0);
        const totalRevenue = data.reduce((sum, b) => sum + b.ingreso_total_ars, 0);
        const totalCommissions = data.reduce((sum, b) => sum + b.comision_booking_ars, 0);
        
        // ADR (Average Daily Rate)
        const adr = totalNights > 0 ? totalRevenue / totalNights : 0;
        
        // Avg Occupancy - calculate average of occupancy_destino_pct
        const avgOccupancy = totalBookings > 0 
            ? data.reduce((sum, b) => sum + b.ocupacion_destino_pct, 0) / totalBookings 
            : 0;

        // Commission Ratio
        const commissionRatio = totalRevenue > 0 ? (totalCommissions / totalRevenue) * 100 : 0;

        return {
            totalBookings,
            totalNights,
            totalRevenue,
            adr,
            avgOccupancy,
            totalCommissions,
            commissionRatio
        };
    };

    // Update KPI UI Elements
    const updateKPIsUI = (metrics) => {
        kpiTotalBookings.textContent = metrics.totalBookings.toLocaleString("es-AR");
        kpiTotalNights.textContent = `${metrics.totalNights.toLocaleString("es-AR")} noches`;
        kpiTotalRevenue.textContent = formatCurrency(metrics.totalRevenue);
        kpiAdr.textContent = formatCurrency(metrics.adr);
        kpiAvgOccupancy.textContent = `${metrics.avgOccupancy.toFixed(1)}%`;
        kpiTotalCommissions.textContent = formatCurrency(metrics.totalCommissions);
        kpiCommissionRatio.textContent = `${metrics.commissionRatio.toFixed(1)}%`;

        // Occupancy Trend Badge style & text
        if (metrics.avgOccupancy >= 75) {
            kpiOccupancyTrend.textContent = "Excelente";
            kpiOccupancyTrend.className = "trend-badge positive";
        } else if (metrics.avgOccupancy >= 55) {
            kpiOccupancyTrend.textContent = "Estable";
            kpiOccupancyTrend.className = "trend-badge neutral";
        } else {
            kpiOccupancyTrend.textContent = "Crítica";
            kpiOccupancyTrend.className = "trend-badge danger";
            kpiOccupancyTrend.style.background = "rgba(239, 68, 68, 0.12)";
        }
    };

    // 6. Dynamic AI Recommendations & Demand Alerts Engine
    const updateAIRecommendations = (data) => {
        alertsContainer.innerHTML = "";
        
        // A. Comisión Alerta
        const bookingBookings = data.filter(b => b.canal_reserva === "Booking");
        const totalCommissions = data.reduce((sum, b) => sum + b.comision_booking_ars, 0);
        const bookingRevenue = bookingBookings.reduce((sum, b) => sum + b.ingreso_total_ars, 0);
        
        if (totalCommissions > 500000) {
            const potentialSavings = totalCommissions * 0.4; // 40% target direct shift
            const alertItem = document.createElement("div");
            alertItem.className = "alert-item danger";
            alertItem.innerHTML = `
                <div class="alert-icon">💸</div>
                <div class="alert-details">
                    <div class="alert-item-title">Fuga Alta en Comisiones (Booking.com)</div>
                    <div class="alert-desc">Se han pagado <strong>${formatCurrency(totalCommissions)}</strong> en comisiones a terceros. Esto representa el 15% del total facturado por este canal.</div>
                    <div class="alert-suggestion">💡 <strong>Sugerencia:</strong> Migrando un 40% a reservas directas (Web/WhatsApp) retendría un beneficio extra de <strong>${formatCurrency(potentialSavings)}</strong>.</div>
                </div>
            `;
            alertsContainer.appendChild(alertItem);
        }

        // B. Demand Inequality Alert (Marketing Relocation)
        // Let's compute average occupancy by destination
        const dests = ["Bariloche", "Córdoba", "Monte Hermoso"];
        const destOccupancy = {};
        
        dests.forEach(d => {
            const destBookings = BOOKINGS_DATA.filter(b => b.destino === d);
            const avgOcc = destBookings.reduce((sum, b) => sum + b.ocupacion_destino_pct, 0) / destBookings.length;
            destOccupancy[d] = avgOcc;
        });

        // Find min and max
        let minDest = "Bariloche";
        let maxDest = "Bariloche";
        dests.forEach(d => {
            if (destOccupancy[d] < destOccupancy[minDest]) minDest = d;
            if (destOccupancy[d] > destOccupancy[maxDest]) maxDest = d;
        });

        const gap = destOccupancy[maxDest] - destOccupancy[minDest];
        if (gap > 15) {
            const alertItem = document.createElement("div");
            alertItem.className = "alert-item warning";
            alertItem.innerHTML = `
                <div class="alert-icon">📢</div>
                <div class="alert-details">
                    <div class="alert-item-title">Desbalance Crítico de Demanda Multidestino</div>
                    <div class="alert-desc">Existe una disparidad de <strong>${gap.toFixed(1)}%</strong> de ocupación entre <strong>${maxDest}</strong> (${destOccupancy[maxDest].toFixed(1)}%) y <strong>${minDest}</strong> (${destOccupancy[minDest].toFixed(1)}%).</div>
                    <div class="alert-suggestion">⚡ <strong>Acción Recomendada:</strong> Reasignar el 60% del presupuesto publicitario de redes sociales de ${maxDest} hacia <strong>${minDest}</strong> para equilibrar la ocupación y maximizar ingresos.</div>
                </div>
            `;
            alertsContainer.appendChild(alertItem);
        }

        // C. Dynamic Pricing Alert
        // Check if any destination has extremely high or low occupancy
        dests.forEach(d => {
            const occ = destOccupancy[d];
            if (occ > 80) {
                const alertItem = document.createElement("div");
                alertItem.className = "alert-item success";
                alertItem.innerHTML = `
                    <div class="alert-icon">📈</div>
                    <div class="alert-details">
                        <div class="alert-item-title">Alta Ocupación en ${d} (${occ.toFixed(1)}%)</div>
                        <div class="alert-desc">La demanda supera el 80%. Las cabañas y suites premium tienen una proyección de ocupación casi completa.</div>
                        <div class="alert-suggestion">🏷️ <strong>Tarifas Dinámicas:</strong> Se recomienda aplicar un incremento del <strong>10% al 15%</strong> en tarifas de fin de semana para las próximas plazas.</div>
                    </div>
                `;
                alertsContainer.appendChild(alertItem);
            } else if (occ < 55) {
                const alertItem = document.createElement("div");
                alertItem.className = "alert-item warning";
                alertItem.innerHTML = `
                    <div class="alert-icon">📉</div>
                    <div class="alert-details">
                        <div class="alert-item-title">Baja Demanda Detectada en ${d} (${occ.toFixed(1)}%)</div>
                        <div class="alert-desc">Ocupación por debajo del umbral de rentabilidad óptima. La temporada requiere incentivos de reserva.</div>
                        <div class="alert-suggestion">🎁 <strong>Estrategia Comercial:</strong> Lanzar una campaña de "Noches de Regalo" (3x2 en días de semana) canalizada exclusivamente por WhatsApp e Instagram.</div>
                    </div>
                `;
                alertsContainer.appendChild(alertItem);
            }
        });

        // D. Direct Channel Optimization Recommendation
        const directRatio = (data.filter(b => ["WhatsApp", "Web Propia", "Instagram"].includes(b.canal_reserva)).length / data.length) * 100;
        if (directRatio < 60) {
            const alertItem = document.createElement("div");
            alertItem.className = "alert-item info";
            alertItem.innerHTML = `
                <div class="alert-icon">💡</div>
                <div class="alert-details">
                    <div class="alert-item-title">Plan de Fidelización Directo (WhatsApp / Web)</div>
                    <div class="alert-desc">Los canales directos representan el <strong>${directRatio.toFixed(1)}%</strong> del volumen actual. El resto depende de intermediarios costosos.</div>
                    <div class="alert-suggestion">🔗 <strong>Propuesta Digital:</strong> Automatizar el envío de un código de descuento único del 10% a huéspedes anteriores para evitar que reserven en Booking en su próxima visita.</div>
                </div>
            `;
            alertsContainer.appendChild(alertItem);
        }
    };

    // 7. Interactive Commission Simulator
    const updateSimulator = (data) => {
        // Calculate original total commissions of filtered dataset
        const totalCommissions = data.reduce((sum, b) => sum + b.comision_booking_ars, 0);
        const totalRevenue = data.reduce((sum, b) => sum + b.ingreso_total_ars, 0);
        
        // Savings = Commissions * (conversion_percentage / 100)
        const savings = totalCommissions * (commissionConversionRate / 100);
        
        // Net profit increase
        const netIncomeOriginal = totalRevenue - totalCommissions;
        const profitIncreasePct = netIncomeOriginal > 0 ? (savings / netIncomeOriginal) * 100 : 0;

        // Update UI
        sliderPercentageVal.textContent = `${commissionConversionRate}%`;
        simSavings.textContent = formatCurrency(savings);
        simProfitPct.textContent = `+${profitIncreasePct.toFixed(2)}%`;
    };

    // 8. Chart.js Render Engine
    const updateCharts = (data) => {
        // Prepare data groupings
        
        // A. Group by Month (Revenue)
        // Months array for labels
        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo"];
        const monthlyRevenue = { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0 };
        const monthlyDirect = { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0 };
        const monthlyBooking = { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0 };

        data.forEach(b => {
            const dateStr = b.fecha_reserva; // e.g. "2026-03-12"
            if (dateStr) {
                const month = dateStr.split("-")[1];
                if (monthlyRevenue[month] !== undefined) {
                    monthlyRevenue[month] += b.ingreso_total_ars;
                    if (b.canal_reserva === "Booking") {
                        monthlyBooking[month] += b.ingreso_total_ars;
                    } else {
                        monthlyDirect[month] += b.ingreso_total_ars;
                    }
                }
            }
        });

        const revData = Object.values(monthlyRevenue);
        const revDirect = Object.values(monthlyDirect);
        const revBooking = Object.values(monthlyBooking);

        // B. Group by Channel
        const channelsCount = { "Booking": 0, "WhatsApp": 0, "Web Propia": 0, "Instagram": 0 };
        data.forEach(b => {
            if (channelsCount[b.canal_reserva] !== undefined) {
                channelsCount[b.canal_reserva]++;
            }
        });

        // C. Group by Destination (Occupancy Average)
        const dests = ["Bariloche", "Córdoba", "Monte Hermoso"];
        const destOccAverages = dests.map(d => {
            const destBookings = data.filter(b => b.destino === d);
            if (destBookings.length === 0) return 0;
            return destBookings.reduce((sum, b) => sum + b.ocupacion_destino_pct, 0) / destBookings.length;
        });

        // D. Group by Room Type (Revenue)
        const roomTypes = ["Suite Premium", "Cabaña Standard", "Cabaña Familiar"];
        const roomRevenues = roomTypes.map(t => {
            return data.filter(b => b.tipo_alojamiento === t)
                       .reduce((sum, b) => sum + b.ingreso_total_ars, 0);
        });

        // Chart styling options
        const chartOptionsBase = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#9ca3af', font: { family: 'Inter', size: 11 } }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#9ca3af', font: { family: 'Inter' } }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#9ca3af', font: { family: 'Inter' } }
                }
            }
        };

        // --- CHART 1: REVENUE TIME SERIES ---
        if (charts.revenueTime) charts.revenueTime.destroy();
        const ctxRevenue = document.getElementById("revenueTimeChart").getContext("2d");
        
        let revenueDatasets = [
            {
                label: 'Ingresos Totales (ARS)',
                data: revData,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.35,
                shadowColor: 'rgba(99, 102, 241, 0.5)',
                shadowBlur: 10
            }
        ];

        // If 'all' destinations are filtered, show direct vs booking breakdown!
        if (currentDestination === "all") {
            revenueDatasets.push({
                label: 'Canales Directos',
                data: revDirect,
                borderColor: '#10b981',
                borderDash: [5, 5],
                backgroundColor: 'transparent',
                borderWidth: 1.5,
                tension: 0.35
            });
            revenueDatasets.push({
                label: 'Booking.com',
                data: revBooking,
                borderColor: '#ef4444',
                borderDash: [5, 5],
                backgroundColor: 'transparent',
                borderWidth: 1.5,
                tension: 0.35
            });
        }

        charts.revenueTime = new Chart(ctxRevenue, {
            type: 'line',
            data: {
                labels: monthNames,
                datasets: revenueDatasets
            },
            options: {
                ...chartOptionsBase,
                plugins: {
                    ...chartOptionsBase.plugins,
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
                            }
                        }
                    }
                },
                scales: {
                    ...chartOptionsBase.scales,
                    y: {
                        ...chartOptionsBase.scales.y,
                        ticks: {
                            color: '#9ca3af',
                            callback: function(value) {
                                return (value / 1000000) + 'M ARS';
                            }
                        }
                    }
                }
            }
        });

        // --- CHART 2: BOOKINGS BY CHANNEL ---
        if (charts.channels) charts.channels.destroy();
        const ctxChannels = document.getElementById("channelsChart").getContext("2d");
        charts.channels = new Chart(ctxChannels, {
            type: 'doughnut',
            data: {
                labels: Object.keys(channelsCount),
                datasets: [{
                    data: Object.values(channelsCount),
                    backgroundColor: [
                        'rgba(0, 53, 128, 0.75)', // Booking
                        'rgba(37, 211, 102, 0.75)', // WhatsApp
                        'rgba(139, 92, 246, 0.75)', // Web
                        'rgba(225, 48, 108, 0.75)'  // Instagram
                    ],
                    borderColor: 'rgba(11, 15, 25, 1)',
                    borderWidth: 2,
                    hoverOffset: 12
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: '#9ca3af', boxWidth: 12, font: { family: 'Inter', size: 10 } }
                    }
                },
                cutout: '70%'
            }
        });

        // --- CHART 3: OCCUPANCY BY DESTINATION ---
        if (charts.occupancyDest) charts.occupancyDest.destroy();
        const ctxOccDest = document.getElementById("occupancyDestChart").getContext("2d");
        
        // Map dynamic colors based on destination HSL values
        const borderColors = [
            'rgba(0, 242, 254, 1)',
            'rgba(60, 186, 146, 1)',
            'rgba(255, 106, 0, 1)'
        ];
        const backgroundColors = [
            'rgba(0, 242, 254, 0.2)',
            'rgba(60, 186, 146, 0.2)',
            'rgba(255, 106, 0, 0.2)'
        ];

        // If specific destination is selected, highlight only that one
        let destLabels = dests;
        let destData = destOccAverages;
        let finalBg = backgroundColors;
        let finalBorder = borderColors;

        if (currentDestination !== "all") {
            const idx = dests.indexOf(currentDestination);
            finalBg = dests.map((d, i) => i === idx ? backgroundColors[idx] : 'rgba(255, 255, 255, 0.02)');
            finalBorder = dests.map((d, i) => i === idx ? borderColors[idx] : 'rgba(255, 255, 255, 0.05)');
        }

        charts.occupancyDest = new Chart(ctxOccDest, {
            type: 'bar',
            data: {
                labels: destLabels,
                datasets: [{
                    label: 'Ocupación Destino (%)',
                    data: destData,
                    backgroundColor: finalBg,
                    borderColor: finalBorder,
                    borderWidth: 1.5,
                    borderRadius: 6
                }]
            },
            options: {
                ...chartOptionsBase,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    ...chartOptionsBase.scales,
                    y: {
                        ...chartOptionsBase.scales.y,
                        min: 0,
                        max: 100,
                        ticks: {
                            color: '#9ca3af',
                            callback: function(value) { return value + '%'; }
                        }
                    }
                }
            }
        });

        // --- CHART 4: REVENUE BY ROOM TYPE ---
        if (charts.roomType) charts.roomType.destroy();
        const ctxRoom = document.getElementById("roomTypeChart").getContext("2d");
        
        charts.roomType = new Chart(ctxRoom, {
            type: 'bar',
            data: {
                labels: roomTypes,
                datasets: [{
                    label: 'Ventas (ARS)',
                    data: roomRevenues,
                    backgroundColor: [
                        'rgba(168, 85, 247, 0.2)', // Suite
                        'rgba(99, 102, 241, 0.2)', // Standard
                        'rgba(16, 185, 129, 0.2)'  // Familiar
                    ],
                    borderColor: [
                        '#a855f7',
                        '#6366f1',
                        '#10b981'
                    ],
                    borderWidth: 1.5,
                    borderRadius: 6
                }]
            },
            options: {
                ...chartOptionsBase,
                indexAxis: 'y', // Horizontal bars
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Ingresos: ${formatCurrency(context.parsed.x)}`;
                            }
                        }
                    }
                },
                scales: {
                    ...chartOptionsBase.scales,
                    x: {
                        ...chartOptionsBase.scales.x,
                        ticks: {
                            color: '#9ca3af',
                            callback: function(value) {
                                return (value / 1000000) + 'M ARS';
                            }
                        }
                    }
                }
            }
        });
    };

    // 9. Reservations Table Render Engine
    const updateReservationsTable = () => {
        // A. Apply Filtering
        const searchText = searchInput.value.toLowerCase().trim();
        const destFilter = filterDestination.value;
        const chanFilter = filterChannel.value;

        filteredTableData = BOOKINGS_DATA.filter(booking => {
            // Search text check
            const matchesSearch = 
                booking.id_reserva.toString().includes(searchText) ||
                booking.destino.toLowerCase().includes(searchText) ||
                booking.tipo_alojamiento.toLowerCase().includes(searchText) ||
                booking.canal_reserva.toLowerCase().includes(searchText) ||
                booking.fecha_reserva.includes(searchText);

            // Destination Check
            const matchesDest = (destFilter === "all") || (booking.destino === destFilter);

            // Channel Check
            const matchesChan = (chanFilter === "all") || (booking.canal_reserva === chanFilter);

            return matchesSearch && matchesDest && matchesChan;
        });

        // B. Apply Sorting
        filteredTableData.sort((a, b) => {
            let valA = a[currentSortColumn];
            let valB = b[currentSortColumn];

            // Handle date strings
            if (currentSortColumn === "fecha_reserva") {
                valA = new Date(valA);
                valB = new Date(valB);
            }

            if (valA < valB) return currentSortDirection === "asc" ? -1 : 1;
            if (valA > valB) return currentSortDirection === "asc" ? 1 : -1;
            return 0;
        });

        // C. Paginate Rows
        const totalRows = filteredTableData.length;
        const totalPages = Math.ceil(totalRows / rowsPerPage) || 1;
        
        // Keep page within boundaries
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = Math.min(startIndex + rowsPerPage, totalRows);
        const paginatedRows = filteredTableData.slice(startIndex, endIndex);

        // D. Render Table Body
        tableBody.innerHTML = "";
        
        if (paginatedRows.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align: center; color: var(--text-muted); padding: 3rem;">
                        No se encontraron reservas con los filtros aplicados.
                    </td>
                </tr>
            `;
            tableShowingText.textContent = "Mostrando 0 de 0 reservas";
            paginationContainer.innerHTML = "";
            return;
        }

        paginatedRows.forEach(b => {
            const tr = document.createElement("tr");
            
            // Destination Badge Class
            let destClass = "";
            if (b.destino === "Bariloche") destClass = "dest-bariloche";
            else if (b.destino === "Córdoba") destClass = "dest-cordoba";
            else if (b.destino === "Monte Hermoso") destClass = "dest-montehermoso";

            // Channel Badge Class
            let chanClass = "";
            if (b.canal_reserva === "Booking") chanClass = "chan-booking";
            else if (b.canal_reserva === "WhatsApp") chanClass = "chan-whatsapp";
            else if (b.canal_reserva === "Web Propia") chanClass = "badge-web";
            else if (b.canal_reserva === "Instagram") chanClass = "chan-instagram";

            tr.innerHTML = `
                <td style="font-weight: 600; color: white;">#${b.id_reserva}</td>
                <td><span class="badge ${destClass}">${b.destino}</span></td>
                <td style="font-weight: 500;">${b.tipo_alojamiento}</td>
                <td><span class="badge ${chanClass}">${b.canal_reserva}</span></td>
                <td style="color: var(--text-secondary);">${b.fecha_reserva}</td>
                <td style="text-align: center;">${b.cantidad_noches}</td>
                <td>${formatCurrency(b.tarifa_noche_ars)}</td>
                <td style="font-weight: 600; color: white;">${formatCurrency(b.ingreso_total_ars)}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-weight: 500;">${b.ocupacion_destino_pct}%</span>
                        <div style="width: 40px; height: 4px; background: rgba(255,255,255,0.05); border-radius: 2px; overflow: hidden;">
                            <div style="width: ${b.ocupacion_destino_pct}%; height: 100%; background: ${b.ocupacion_destino_pct > 75 ? 'var(--color-success)' : b.ocupacion_destino_pct > 50 ? 'var(--color-warning)' : 'var(--color-danger)'};"></div>
                        </div>
                    </div>
                </td>
                <td style="color: ${b.comision_booking_ars > 0 ? 'var(--color-danger)' : 'var(--text-muted)'}; font-weight: 500;">
                    ${b.comision_booking_ars > 0 ? formatCurrency(b.comision_booking_ars) : "—"}
                </td>
            `;
            tableBody.appendChild(tr);
        });

        // E. Update Table Info Text
        tableShowingText.textContent = `Mostrando ${startIndex + 1}-${endIndex} de ${totalRows} reservas`;

        // F. Render Pagination Controls
        paginationContainer.innerHTML = "";
        
        // Previous Button
        const prevBtn = document.createElement("button");
        prevBtn.className = "page-btn";
        prevBtn.innerHTML = "«";
        prevBtn.disabled = currentPage === 1;
        prevBtn.addEventListener("click", () => {
            currentPage--;
            updateReservationsTable();
        });
        paginationContainer.appendChild(prevBtn);

        // Page Number Buttons (Limit to max 5 displayed pages)
        const maxPagesToShow = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
        let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
        
        if (endPage - startPage + 1 < maxPagesToShow) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement("button");
            pageBtn.className = `page-btn ${currentPage === i ? 'active' : ''}`;
            pageBtn.textContent = i;
            pageBtn.addEventListener("click", () => {
                currentPage = i;
                updateReservationsTable();
            });
            paginationContainer.appendChild(pageBtn);
        }

        // Next Button
        const nextBtn = document.createElement("button");
        nextBtn.className = "page-btn";
        nextBtn.innerHTML = "»";
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.addEventListener("click", () => {
            currentPage++;
            updateReservationsTable();
        });
        paginationContainer.appendChild(nextBtn);
    };

    // 10. Dashboard Filter Controller (Global Filter Bar)
    const filterDashboardData = (destination) => {
        currentDestination = destination;
        
        // Update active class on buttons
        destinationBtns.forEach(btn => {
            if (btn.getAttribute("data-destination") === destination) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        });

        // Filter master dataset
        const filteredData = destination === "all" 
            ? BOOKINGS_DATA 
            : BOOKINGS_DATA.filter(b => b.destino === destination);

        // Update metric calculations, KPIs, alerts and charts
        const metrics = calculateMetrics(filteredData);
        updateKPIsUI(metrics);
        updateAIRecommendations(filteredData);
        updateSimulator(filteredData);
        updateCharts(filteredData);
        
        // Mirror the destination selection in the table filter dropdown for UX coherence
        filterDestination.value = destination;
        currentPage = 1;
        updateReservationsTable();
    };

    // 11. Event Listeners Config

    // Tab Switching
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            const selectedTab = tab.getAttribute("data-tab");
            
            // Update active sidebar state
            tabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");

            // Show matching tab panel
            tabContents.forEach(content => {
                if (content.id === selectedTab) {
                    content.classList.add("active");
                } else {
                    content.classList.remove("active");
                }
            });

            // Specific titles for tabs
            const pTitle = document.getElementById("page-title");
            const pSub = document.getElementById("page-subtitle");
            
            if (selectedTab === "dashboard-tab") {
                pTitle.textContent = "Tablero de Decisiones";
                pSub.textContent = "Consolidado Multidestino: Monte Hermoso, Córdoba & Bariloche";
                document.getElementById("destination-filters-container").style.display = "flex";
            } else if (selectedTab === "reservations-tab") {
                pTitle.textContent = "Registro General de Reservas";
                pSub.textContent = "Auditoría de reservas, canales y estados de ocupación";
                document.getElementById("destination-filters-container").style.display = "none";
                updateReservationsTable();
            } else {
                pTitle.textContent = "Estrategia de Transformación Digital";
                pSub.textContent = "Planificación académica, backlog del producto y arquitectura propuesta";
                document.getElementById("destination-filters-container").style.display = "none";
            }
            activeTab = selectedTab;
        });
    });

    // Destination filter button click listeners
    destinationBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const dest = btn.getAttribute("data-destination");
            filterDashboardData(dest);
        });
    });

    // Slider for simulation conversion rate
    conversionSlider.addEventListener("input", (e) => {
        commissionConversionRate = parseInt(e.target.value);
        
        // Filter dataset based on current destination
        const filteredData = currentDestination === "all" 
            ? BOOKINGS_DATA 
            : BOOKINGS_DATA.filter(b => b.destino === currentDestination);

        updateSimulator(filteredData);
    });

    // Reservations view filters listeners
    searchInput.addEventListener("input", () => {
        currentPage = 1;
        updateReservationsTable();
    });

    filterDestination.addEventListener("change", (e) => {
        currentPage = 1;
        
        // If we are in the reservations tab, mirror it to the dashboard global filter as well!
        currentDestination = e.target.value;
        destinationBtns.forEach(btn => {
            if (btn.getAttribute("data-destination") === currentDestination) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        });
        
        // Redraw table
        updateReservationsTable();

        // Recalculate dashboard background aggregates so they match when user clicks back to dashboard
        const filteredData = currentDestination === "all" 
            ? BOOKINGS_DATA 
            : BOOKINGS_DATA.filter(b => b.destino === currentDestination);
        
        const metrics = calculateMetrics(filteredData);
        updateKPIsUI(metrics);
        updateAIRecommendations(filteredData);
        updateSimulator(filteredData);
        updateCharts(filteredData);
    });

    filterChannel.addEventListener("change", () => {
        currentPage = 1;
        updateReservationsTable();
    });

    // Table sorting listener on headers click
    tableHeaders.forEach(th => {
        th.addEventListener("click", () => {
            const col = th.getAttribute("data-sort");
            
            if (currentSortColumn === col) {
                // toggle direction
                currentSortDirection = currentSortDirection === "asc" ? "desc" : "asc";
            } else {
                currentSortColumn = col;
                currentSortDirection = "asc";
            }

            // reset icons on headers
            tableHeaders.forEach(h => {
                const label = h.textContent.replace(/[↕↑↓]/g, "").trim();
                if (h.getAttribute("data-sort") === currentSortColumn) {
                    h.textContent = `${label} ${currentSortDirection === "asc" ? "↑" : "↓"}`;
                } else {
                    h.textContent = `${label} ↕`;
                }
            });

            updateReservationsTable();
        });
    });

    // Export CSV generator in pure client-side JS
    btnExportCsv.addEventListener("click", () => {
        if (filteredTableData.length === 0) return;
        
        // CSV header line
        const headers = ["ID Reserva", "Destino", "Tipo Alojamiento", "Canal Reserva", "Fecha Reserva", "Cantidad Noches", "Tarifa Noche ARS", "Ingreso Total ARS", "Ocupación Destino %", "Comisión Booking ARS"];
        let csvContent = "\ufeff"; // BOM for UTF-8 compatibility in Excel
        csvContent += headers.join(";") + "\n";

        // Rows content lines
        filteredTableData.forEach(row => {
            const rowData = [
                row.id_reserva,
                `"${row.destino}"`,
                `"${row.tipo_alojamiento}"`,
                `"${row.canal_reserva}"`,
                row.fecha_reserva,
                row.cantidad_noches,
                row.tarifa_noche_ars,
                row.ingreso_total_ars,
                row.ocupacion_destino_pct,
                row.comision_booking_ars
            ];
            csvContent += rowData.join(";") + "\n";
        });

        // Trigger file download
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        
        const timestamp = new Date().toISOString().split('T')[0];
        link.setAttribute("href", url);
        link.setAttribute("download", `reservas_las_lechuzas_${currentDestination}_${timestamp}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // 12. Run Application Initializer
    filterDashboardData("all");
});
