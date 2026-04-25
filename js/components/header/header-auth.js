// js/components/header-auth.js

(function(){

function createHeaderAuth(){

let user = null;

function token(){
  if(window.MarketUtils?.getToken){
    return window.MarketUtils.getToken();
  }
  return window.MarketAPI?.getToken?.() || "";
}

async function loadUser(){

  if(!token()){
    user = null;
    return null;
  }

  try{

    const res = await MarketAPI.apiFetch("/api/auth/me");

    if(!res.ok){
      user = null;
      return null;
    }

    const data = await res.json().catch(()=>({}));
    user = data.user || null;

  }catch{
    user = null;
  }

  return user;

}

function getUser(){
  return user;
}

function isLogged(){
  return !!token();
}

return{
  loadUser,
  getUser,
  isLogged
};

}

window.HeaderAuth = createHeaderAuth();

})();