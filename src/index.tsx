import React, * as R from 'react';
import ReactDOM from 'react-dom/client';
import './main.css';
import reportWebVitals from './reportWebVitals';
import * as FB from 'firebase/app';
import * as FS from 'firebase/firestore';

type Color = Exclude<React.CSSProperties["color"], undefined>;

type DatabaseStructure =
{
    "hh-counter": { [D in string]:
    {
        "owner": string;
        "time-stamp": FS.Timestamp;
        "marker"?: keyof DatabaseStructure["hh-marker-type"];
        "camera-number"?: number;
        "comment"?: string;
    }}
    "hh-marker-type": { [D in string]:
    {
        "color": Color | [Color, Color];
        "label": string;
        "order"?: number;
    }}
}

type ValueOf<T extends { [K in keyof any]: any }> = T[keyof T];

let temp;

function CounterPanel({ label, buttonLabel, colors, counterCount, onClick } : 
{ 
    label: string;
    buttonLabel: string;
    colors: [Color, Color] | Color;
    counterCount?: number | string;
    onClick: () => void;
})
{
    const sampleColor = (from: number, to: number): string => `no-repeat padding-box ${typeof colors == "object" ? `linear-gradient(${colors[0]} ${from}%, ${colors[1]} ${to}%)` : colors}`;
    
    return (
        <div style={{ display: "flex", flexDirection: "column", flex: "1", height: "min-content", minWidth: "min(72pt, 100%)" }}>
            { counterCount !== undefined ? <span style={{ margin: "4pt", color: "#FFF8" }}>{`(${counterCount})`}</span> : undefined }
            <div className="large block" style={{
                background: sampleColor(0, 300),
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0
            }}>{label}</div>
            <div style={{ display: "flex", flexDirection: "row" }}>
                <button onClick={onClick} className="mega button" style={{
                    flex: "1",
                    background: sampleColor(-50, 100),
                    borderTopLeftRadius: 0,
                    borderTopRightRadius: 0
                }}>{buttonLabel}</button>
            </div>
        </div>
    );
}

const app = FB.initializeApp({
    apiKey: "AIzaSyAb94HnQy1kpb19rRRLHrHiWikOJOrSeKA",
    authDomain: "wfhh-tools.firebaseapp.com",
    projectId: "wfhh-tools",
    storageBucket: "wfhh-tools.appspot.com",
    messagingSenderId: "276208537946",
    appId: "1:276208537946:web:793822745f50a051f82363"
});

const db = FS.getFirestore(app);

const collection = <C extends keyof DatabaseStructure>(name: C) => FS.collection(db, name) as FS.CollectionReference<ValueOf<DatabaseStructure[C]>>;

let refreshValues = () => {};

function App()
{
    const [counterElements, setCounterElements] = R.useState<[string, ValueOf<DatabaseStructure["hh-marker-type"]>][] | { error: any }>();
    const [counterCounts, setCounterCounts] = R.useState({} as { [D in keyof DatabaseStructure["hh-marker-type"]]?: number });
    const [totalCount, setTotalCount] = R.useState(0);
    const [ownerID, setOwnerID] = R.useState("");
    const [commentText, setCommentText] = R.useState("");
    const [cameraNumberText, setCameraNumberText] = R.useState("");
    const [timeText, setTimeText] = R.useState("");
    const [timeOffset, setTimeOffset] = R.useState<number>();
    const [clockTimeText, setClockTimeText] = R.useState<string>();
    const [counterLog, setCounterLog] = R.useState([] as ({ timeStamp: FS.Timestamp } & ({ marker: keyof DatabaseStructure["hh-marker-type"] } | { comment: string }))[]);
    const [globalErrorMessage, setGlobalErrorMessage] = R.useState<string>();

    function allowAddRecord() { return ownerID.match(/^\s*$/) == null && timeOffset !== undefined }

    R.useEffect(() =>
    {
        const intervals: ReturnType<typeof setInterval>[] = [];

        FS.getDocs(collection("hh-marker-type"))
            .then((e) => 
            {
                let newCounterCounts = {} as { [D in keyof DatabaseStructure["hh-marker-type"]]?: number };
                let newTotalCount = 0;
                for (const doc of e.docs)
                    newCounterCounts[doc.id] = 0;
                setCounterCounts(newCounterCounts);
                setTotalCount(newTotalCount);

                setCounterElements(e.docs.sort((d) => d.data().order ?? 0).map((d) => [d.id, d.data()]));
            })
            .catch((e) => setCounterElements({ error: e }));

        setTimeout(() => refreshValues(), 500);
        intervals.push(setInterval(() => refreshValues(), 10000));

        return () => intervals.forEach(clearInterval);
    }, 
    []);
    
    R.useEffect(() => { refreshValues = () => 
    {
        const promises = [] as Promise<{ marker: keyof typeof counterCounts, count: number }>[]

        for (const marker in counterCounts)
            promises.push(FS.getCountFromServer(FS.query(collection("hh-counter"), 
                    FS.and(
                        FS.where("marker", "==", marker), 
                        FS.where("time-stamp", ">", FS.Timestamp.fromDate(new Date(new Date(Date.now()).toDateString())))
                    )))
                .then((e) => ({ marker: marker, count: e.data().count })))

        Promise.all(promises)
            .then((v) =>
            {
                let newCounterCounts = {} as { [D in keyof DatabaseStructure["hh-marker-type"]]?: number };
                let newTotalCount = 0;
                for (const data of v)
                {
                    newCounterCounts[data.marker] = data.count;
                    if (data.marker !== "Event")
                        newTotalCount += data.count;
                }
                setTotalCount(newTotalCount);
                setCounterCounts(newCounterCounts);
            },
            (e) => { const error = `Error refreshing counter totals:\n${e}`; setGlobalErrorMessage(error); console.error(error) })
    }},
    [counterCounts]);
    
    R.useEffect(() =>
    {
        if (timeOffset === undefined)
            setClockTimeText(undefined);
        else
        {
            const interval = setInterval(() => setClockTimeText(new Date(Date.now() + timeOffset).toLocaleTimeString()));
            return () => clearInterval(interval);
        }
    }, 
    [timeOffset]);

    return (
        <React.StrictMode>
            <h1 style={{ textAlign: "center" }}>Timed Counter</h1>

            {
                !allowAddRecord() ?
                <div className="large normal-text block" style={{
                    marginInline: "24pt",
                    marginBottom: "12pt",
                    backgroundImage: "linear-gradient(#7b7d80, #36414e)",
                }}>
                    Define an owner ID and the current time to start.
                    <a className="mega button" href="#see1" style={{margin: "8pt"}}>See</a>
                </div>
                : undefined
            }

            {
                globalErrorMessage !== undefined
                ? <button className="normal-text button" style={{ marginInline: "24pt", marginBottom: "12pt", backgroundColor: "0002", color: "red" }} onClick={() => setGlobalErrorMessage(undefined)}><code>{globalErrorMessage}</code></button>
                : undefined
            }
            
            <div className="mark" style={{
                marginInline: "8pt",
                marginBottom: "12pt",
                padding: "12pt",
                backgroundColor: "#FFF2",
                
                display: "flex",
                flexDirection: "row",
                gap: "12pt",
                flexWrap: "wrap",
            }}>
                {
                    counterElements === undefined ? <code style={{ color: "white" }}>Fetching Counters...</code> :
                    "error" in counterElements ? <code style={{ color: "red" }}>There was an error getting the marker types: ({counterElements.error})</code> :
                    counterElements.map((e) => <CounterPanel key={e[0]} label={e[1].label} buttonLabel="+1" colors={e[1].color} counterCount={counterCounts[e[0]] ?? "?"} onClick={() => 
                    {
                        if (!allowAddRecord())
                        {
                            setGlobalErrorMessage(`Cannot add record without a creator ID and a time.`);
                            return;
                        }

                        const timeStamp = FS.Timestamp.fromDate(new Date(Date.now() + timeOffset!));

                        const newDocument: ValueOf<DatabaseStructure["hh-counter"]> = 
                        {
                            "owner": ownerID,
                            "time-stamp": timeStamp,
                            "marker": e[0],
                        };
                        
                        FS.setDoc(FS.doc(collection("hh-counter"), `${ownerID}:${timeStamp.toMillis()}`), newDocument)
                        .catch((e) => { const error = `Error adding record at ${timeStamp.toDate().toLocaleTimeString()}:\n${e}`; setGlobalErrorMessage(error); console.error(error) });

                        const newCounterLog = [...counterLog, { timeStamp: timeStamp, marker: e[0] }];

                        setCounterLog(newCounterLog);
                        setCounterCounts({ ...counterCounts, [e[0]]: (counterCounts[e[0]] ?? 0) + 1 });
                        if (e[0] !== "Event")
                            setTotalCount(totalCount + 1);
                    }}
                    />)
                }
            </div>
            
            <div style={{
                marginInline: "24pt",
                marginBottom: "12pt",
                
                display: "flex",
                flexFlow: "row",

                justifyContent: "space-between",
                gap: "16pt",
            }}>
                <CounterPanel label="undo" buttonLabel="-1" colors={["#ff6600", "#8c1000"]} onClick={() => 
                    {
                        if (counterLog.length == 0)
                        {
                            setGlobalErrorMessage(`Cannot undo with no known history`);
                            return;
                        }
                        
                        const indexToRemove = counterLog.length - 1;
                        const logThatsRemoved = counterLog[indexToRemove];

                        FS.deleteDoc(FS.doc(collection("hh-counter"), `${ownerID}:${logThatsRemoved.timeStamp.toMillis()}`))
                        .catch((e) => { const error = `Error deleting record at ${logThatsRemoved.timeStamp.toDate().toLocaleTimeString()}:\n${e}`; setGlobalErrorMessage(error); console.error(error) });

                        setCounterLog(counterLog.filter((l, i) => i !== indexToRemove));
                        if ("marker" in logThatsRemoved)
                        {
                            setCounterCounts({ ...counterCounts, [logThatsRemoved.marker]: (counterCounts[logThatsRemoved.marker] ?? 1) - 1 });
                            
                            if (logThatsRemoved.marker !== "Event")
                                setTotalCount(totalCount - 1);
                        }
                    }}/>
                <div className="normal-text mark" style={{
                    padding: "12pt",
                    height: "min-content",

                    backgroundColor: "#FFF2",

                    alignSelf: "center",
                }}>
                    Total People: {totalCount}
                </div>
            </div>

            <div className="mark" style={{
                marginInline: "12pt",
                marginBottom: "12pt",
                padding: "12pt",
                minHeight: "86pt",
                maxHeight: "400pt",

                display: "flex", 
                flexDirection: "column",

                backgroundColor: "#FFF2",
                borderBottomRightRadius: 0,

                overflow: "hidden",
                resize: "vertical",
            }}>
                <div style={{ flex: "1", display: "flex", flexDirection: "row" }}>
                    <textarea placeholder="// Tap to add comment..." className="large normal-text input" style={{
                        minWidth: "0pt",
                        minHeight: "0pt",

                        flex: "1",

                        backgroundImage: "repeating-linear-gradient(#e700ff22 1pt, #e700ff22 4pt, transparent 4pt, transparent 9pt), linear-gradient(#251421, #470044)",
                        color: "#e76aff",
                        borderBottomLeftRadius: 0,
                        borderBottomRightRadius: 0,

                        resize: "none",
                    }} onChange={(e) => setCommentText(e.target.value)} value={commentText}/>
                </div>
                <div style={{ display: "flex", flexDirection: "row" }}>
                    <button onClick={() => 
                    {
                        if (!allowAddRecord())
                        {
                            setGlobalErrorMessage(`Cannot add record without a creator ID and a time.`);
                            return;
                        }

                        const timeStamp = FS.Timestamp.fromDate(new Date(Date.now() + timeOffset!));

                        const newDocument: ValueOf<DatabaseStructure["hh-counter"]> = 
                        {
                            "owner": ownerID,
                            "time-stamp": timeStamp,
                            "comment": commentText,
                        };

                        if (cameraNumberText.match(/^\s*$/) == null)
                        {
                            newDocument["camera-number"] = Number.parseInt(cameraNumberText);
                            setCameraNumberText("");
                        }
                        
                        FS.setDoc(FS.doc(collection("hh-counter"), `${ownerID}:${timeStamp.toMillis()}`), newDocument)
                        .catch((e) => { const error = `Error adding record at ${timeStamp.toDate().toLocaleTimeString()}:\n${e}`; setGlobalErrorMessage(error); console.error(error) });

                        setCounterLog((v) => [...v, { timeStamp: timeStamp, comment: commentText }]);
                        setCommentText("");
                    }}
                    className="large button" style={{
                        height: "42pt",
                        
                        flex: "2",

                        borderTopLeftRadius: 0,
                        borderTopRightRadius: 0,
                        borderBottomRightRadius: 0,

                        backgroundImage: "linear-gradient(#ec47cd, #670074)",
                    }}>+Comment</button>
                    <div className="large block" style={{
                        flex: "3",
                        
                        borderTopLeftRadius: 0,
                        borderTopRightRadius: 0,
                        borderBottomLeftRadius: 0,
                        
                        backgroundImage: "linear-gradient(#ec47cd, #670074)",
                    }}/>
                </div>
                
                <div style={{
                    marginTop: "16px",
                    width: "min-content",
                    alignSelf: "end",

                    display: "flex",
                    flexFlow: "column",
                }}>
                    <div className="block" style={{
                        borderBottomLeftRadius: 0,
                        borderBottomRightRadius: 0,
                        
                        backgroundImage: "linear-gradient(#534a59, #21112b)",
                    }}>Camera Number</div>
                    <div className="large normal-text input" style={{
                        height: "20pt",

                        backgroundImage: "repeating-linear-gradient(#e700ff22 1pt, #e700ff22 4pt, transparent 4pt, transparent 9pt), linear-gradient(#251421, #470044)",
                        color: "#e76aff",

                        borderRadius: 0,
                    }}>{cameraNumberText}</div>
                    <div className="block" style={{
                        padding: "8pt",

                        display: "flex",
                        flexFlow: "column",
                        gap: "8pt",
                        
                        borderTopLeftRadius: 0,
                        borderTopRightRadius: 0,
                        
                        backgroundImage: "linear-gradient(#534a59, #21112b)",
                    }}>
                        <div style={{flex: "1", display: "flex", flexFlow: "row", gap: "8pt"}}>
                            {["1", "2", "3"].map((v) => <button className="large button" style={{width: "38pt", backgroundImage: "linear-gradient(#534a59, #21112b)"}} onClick={() => setCameraNumberText(cameraNumberText + v)}>{v}</button>)}
                        </div>
                        <div style={{flex: "1", display: "flex", flexFlow: "row", gap: "8pt"}}>
                            {["4", "5", "6"].map((v) => <button className="large button" style={{width: "38pt", backgroundImage: "linear-gradient(#534a59, #21112b)"}} onClick={() => setCameraNumberText(cameraNumberText + v)}>{v}</button>)}
                        </div>
                        <div style={{flex: "1", display: "flex", flexFlow: "row", gap: "8pt"}}>
                            {["7", "8", "9"].map((v) => <button className="large button" style={{width: "38pt", backgroundImage: "linear-gradient(#534a59, #21112b)"}} onClick={() => setCameraNumberText(cameraNumberText + v)}>{v}</button>)}
                        </div>
                        <div style={{flex: "1", display: "flex", flexFlow: "row", gap: "8pt"}}>
                            <button className="large button" style={{width: "38pt", backgroundImage: "linear-gradient(#534a59, #21112b)"}} onClick={() => setCameraNumberText("")}>C</button>
                            <button className="large button" style={{width: "38pt", backgroundImage: "linear-gradient(#534a59, #21112b)"}} onClick={() => setCameraNumberText(cameraNumberText + "0")}>{0}</button>
                            <button className="large button" style={{width: "38pt", backgroundImage: "linear-gradient(#534a59, #21112b)"}} onClick={() => setCameraNumberText(cameraNumberText.substring(0, Math.max(0, cameraNumberText.length - 1)))}>&lt;</button>
                        </div>
                    </div>
                </div>
            </div>

            <div id="see1" style={{
                marginInline: "12pt",
                marginBottom: "12pt",
                padding: "12pt",
                height: "max-content", 
                
                display: "flex", 
                flexDirection: "column",
                alignItems: "stretch",
            }}>
                <div style={{ flex: "1", display: "flex", flexDirection: "row" }}>
                    <input placeholder="Tap to change..." type="text" className="large normal-text input" style={{
                        minWidth: "0pt",
                        minHeight: "0pt",

                        flex: "1",

                        backgroundImage: "repeating-linear-gradient(#18ff0022 1pt, #18ff0022 4pt, transparent 4pt, transparent 9pt), linear-gradient(#081805, #064100)",
                        color: "#81ff73",
                        borderTopRightRadius: 0,
                        borderBottomLeftRadius: 0,
                        borderBottomRightRadius: 0,

                        resize: "none",
                    }} onChange={(e) => setOwnerID(e.target.value)} value={ownerID}/>
                    <input id="time-input" placeholder="0:00" type="text" className="large normal-text input" style={{
                        minWidth: "0pt",
                        minHeight: "0pt",

                        flex: "1",

                        backgroundImage: "repeating-linear-gradient(#18ff0022 1pt, #18ff0022 4pt, transparent 4pt, transparent 9pt), linear-gradient(#081805, #064100)",
                        color: timeOffset !== undefined ? "#81ff73" : "#ff8922",
                        borderTopLeftRadius: 0,
                        borderBottomLeftRadius: 0,
                        borderBottomRightRadius: 0,

                        resize: "none",
                    }} onChange={(e) => { setTimeText(e.target.value); setTimeOffset(undefined) }} value={clockTimeText ?? timeText}/>
                </div>
                <div style={{ display: "flex", flexDirection: "row" }}>
                    <div className="block" style={{
                        flex: "1",
                        
                        borderTopLeftRadius: 0,
                        borderTopRightRadius: 0,
                        borderBottomRightRadius: 0,
                        
                        backgroundImage: "linear-gradient(#89cb7c, #17880c)",

                        textWrap: "nowrap",
                    }}>Owner ID</div>
                    <button className="button" style={{
                        height: "42pt",
                        
                        flex: "1",

                        borderTopLeftRadius: 0,
                        borderTopRightRadius: 0,
                        borderBottomLeftRadius: 0,

                        backgroundImage: "linear-gradient(#89cb7c, #17880c)",
                    }} onClick={() => 
                    {
                        if (timeOffset !== undefined)
                            return;

                        let date = new Date(`${new Date(Date.now()).toDateString()}, ${timeText}`);
                        if (Number.isNaN(date.getTime()))
                            return;

                        setTimeOffset(date.getTime() - Date.now());
                    }}>Tap to Start</button>
                </div>
            </div>
            
            <div style={{ display: "flex", flexFlow: "column", alignItems: "center" }}>
                <button className="button" style={{
                    backgroundImage: "linear-gradient(#89cb7c, #17880c)",
                }} onClick={() => 
                {
                    Promise.all([FS.getDocs(collection("hh-marker-type")), FS.getDocs(collection("hh-counter"))])
                    .then(([m, d]) =>
                    {
                        const markerMap = {} as { [K in keyof DatabaseStructure["hh-marker-type"]]: DatabaseStructure["hh-marker-type"][K]["label"] };
                        for (const doc of m.docs)
                            markerMap[doc.id] = doc.data().label;

                        const blob = new Blob([d.docs.map((d) => 
                        {
                            const data = d.data();

                            return `${data["owner"]}: ${data["time-stamp"].toDate().toLocaleString()}${data["marker"] !== undefined ? ` (${markerMap[data["marker"]]})` : ""}${data["camera-number"] !== undefined ? ` C${data["camera-number"]}` : ""}${data["comment"] !== undefined ? ` //${data["comment"]}` : ""}`
                        }).join("\n")],
                        {type: "text/plain"});

                        const a = document.createElement("a");
                        const url = URL.createObjectURL(blob);
                        a.setAttribute("href", url);
                        a.setAttribute("download", "TimedCounterData.txt");
                        a.click();
                        a.remove();
                    },
                    (e) => { const error = `Error downloading database:\n${e}`; setGlobalErrorMessage(error); console.error(error) })
                }}>Download Database</button>
            </div>

            <div style={{ height: "128pt" }}/>
        </React.StrictMode>
    )
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(<App/>);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();