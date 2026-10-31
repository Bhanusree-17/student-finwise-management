require("dotenv").config();
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(session({
  secret: process.env.SESSION_SECRET || "change-this-session-secret",
  resave: false, saveUninitialized: false,
  cookie: { httpOnly:true, sameSite:"lax", secure: process.env.NODE_ENV === "production", maxAge: 1000*60*60*8 }
}));
app.use(express.static(path.join(__dirname,"public")));

let pool;
async function initDb(){
  const config = {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    waitForConnections:true, connectionLimit:10
  };
  const bootstrap = await mysql.createConnection(config);
  await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${(process.env.DB_NAME || "student_management").replace(/[^a-zA-Z0-9_]/g,"")}\``);
  await bootstrap.end();
  pool = mysql.createPool({...config, database: process.env.DB_NAME || "student_management"});
  await pool.query(`CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(120) NOT NULL,
    email VARCHAR(190) NOT NULL UNIQUE, password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS students (
    id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(150) NOT NULL,
    roll_number VARCHAR(80) NOT NULL UNIQUE, email VARCHAR(190),
    phone VARCHAR(40), department VARCHAR(100) NOT NULL,
    year VARCHAR(20), section VARCHAR(30), gender VARCHAR(30),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);
}
const auth=(req,res,next)=> req.session.adminId ? next() : res.status(401).json({error:"Please log in first."});
app.post("/api/signup",async(req,res)=>{
 try{
  const {name,email,password}=req.body;
  if(!name?.trim()||!email?.trim()||!password) return res.status(400).json({error:"Name, email and password are required."});
  if(password.length<6) return res.status(400).json({error:"Password must contain at least 6 characters."});
  const [exists]=await pool.query("SELECT id FROM admins WHERE email=?",[email.trim().toLowerCase()]);
  if(exists.length) return res.status(409).json({error:"An account with this email already exists."});
  const hash=await bcrypt.hash(password,10);
  const [r]=await pool.query("INSERT INTO admins(name,email,password) VALUES(?,?,?)",[name.trim(),email.trim().toLowerCase(),hash]);
  req.session.adminId=r.insertId; req.session.adminName=name.trim();
  res.json({ok:true,name:req.session.adminName});
 }catch(e){console.error(e);res.status(500).json({error:"Signup failed. Check your database settings."});}
});
app.post("/api/login",async(req,res)=>{
 try{
  const {email,password}=req.body;
  const [rows]=await pool.query("SELECT * FROM admins WHERE email=?",[String(email||"").trim().toLowerCase()]);
  if(!rows.length||!await bcrypt.compare(String(password||""),rows[0].password)) return res.status(401).json({error:"Incorrect email or password."});
  req.session.adminId=rows[0].id;req.session.adminName=rows[0].name;
  res.json({ok:true,name:rows[0].name});
 }catch(e){console.error(e);res.status(500).json({error:"Login failed."});}
});
app.post("/api/logout",(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get("/api/me",auth,(req,res)=>res.json({name:req.session.adminName}));
app.get("/api/stats",auth,async(req,res)=>{
 try{
  const [[{total}]] = await pool.query("SELECT COUNT(*) total FROM students");
  const [[{departments}]] = await pool.query("SELECT COUNT(DISTINCT department) departments FROM students");
  const [[{cse}]] = await pool.query("SELECT COUNT(*) cse FROM students WHERE UPPER(TRIM(department))='CSE'");
  const [[{recent}]] = await pool.query("SELECT COUNT(*) recent FROM students WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)");
  const [byDept]=await pool.query("SELECT department,COUNT(*) count FROM students GROUP BY department ORDER BY count DESC");
  const [latest]=await pool.query("SELECT id,name,roll_number,department,year,section,created_at FROM students ORDER BY created_at DESC LIMIT 6");
  res.json({total,departments,cse,recent,byDept,latest});
 }catch(e){console.error(e);res.status(500).json({error:"Could not load dashboard."});}
});
app.get("/api/students",auth,async(req,res)=>{
 try{
  const {department="",search=""}=req.query;
  let sql="SELECT * FROM students WHERE 1=1", args=[];
  if(department && department!=="All Departments"){sql+=" AND department=?";args.push(department);}
  if(search){sql+=" AND (name LIKE ? OR roll_number LIKE ? OR email LIKE ?)";args.push(`%${search}%`,`%${search}%`,`%${search}%`);}
  sql+=" ORDER BY name";
  const [rows]=await pool.query(sql,args);res.json(rows);
 }catch(e){console.error(e);res.status(500).json({error:"Could not load students."});}
});
app.get("/api/departments",auth,async(req,res)=>{
 const [rows]=await pool.query("SELECT DISTINCT department FROM students ORDER BY department");res.json(rows.map(x=>x.department));
});
app.post("/api/students",auth,async(req,res)=>{
 try{
  const s=req.body;
  if(!s.name?.trim()||!s.roll_number?.trim()||!s.department?.trim())return res.status(400).json({error:"Name, roll number and department are required."});
  const [r]=await pool.query("INSERT INTO students(name,roll_number,email,phone,department,year,section,gender) VALUES(?,?,?,?,?,?,?,?)",
   [s.name.trim(),s.roll_number.trim(),s.email||null,s.phone||null,s.department.trim(),s.year||null,s.section||null,s.gender||null]);
  res.json({ok:true,id:r.insertId});
 }catch(e){if(e.code==="ER_DUP_ENTRY")return res.status(409).json({error:"That roll number already exists."});console.error(e);res.status(500).json({error:"Could not add student."});}
});
app.put("/api/students/:id",auth,async(req,res)=>{
 try{
  const s=req.body;
  if(!s.name?.trim()||!s.roll_number?.trim()||!s.department?.trim())return res.status(400).json({error:"Name, roll number and department are required."});
  await pool.query("UPDATE students SET name=?,roll_number=?,email=?,phone=?,department=?,year=?,section=?,gender=? WHERE id=?",
   [s.name.trim(),s.roll_number.trim(),s.email||null,s.phone||null,s.department.trim(),s.year||null,s.section||null,s.gender||null,req.params.id]);
  res.json({ok:true});
 }catch(e){if(e.code==="ER_DUP_ENTRY")return res.status(409).json({error:"That roll number already exists."});console.error(e);res.status(500).json({error:"Could not update student."});}
});
app.delete("/api/students/:id",auth,async(req,res)=>{
 try{await pool.query("DELETE FROM students WHERE id=?",[req.params.id]);res.json({ok:true});}
 catch(e){console.error(e);res.status(500).json({error:"Could not delete student."});}
});
app.get("/",(req,res)=>res.sendFile(path.join(__dirname,"public","login.html")));
initDb().then(()=>app.listen(process.env.PORT||3000,()=>console.log("Student system running on port "+(process.env.PORT||3000))))
.catch(e=>{console.error("Database setup failed:",e.message);process.exit(1);});