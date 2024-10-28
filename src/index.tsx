import React from 'react';
import ReactDOM from 'react-dom/client';
import './main.css';
import reportWebVitals from './reportWebVitals';

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <h1>Select Tool</h1>
        <div style={{ margin: "", flexDirection: "row" }}>
            <a href="timed-counter.html" style={{ minWidth: "max-content", height: "48pt", background: "no-repeat padding-box linear-gradient(#22e6d3, #0092aa)" }} className="button">Timed Counter</a>
        </div>
    </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();