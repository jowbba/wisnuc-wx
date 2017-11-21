// pages/login/login.js
var app = getApp()
var utils = require('../../utils/util.js')
var { wxlogin, wxGetUserInfo, login, checkTicket, fillTicket, getErrorMessage} = utils
Page({

  /**
   * 页面的初始数据
   */
  data: {
    status:'欢迎使用',
    state:'',
    ticket: false,
    userInfo: {},
    userid: '',
    token: '',
    creatorInfo: {},
    test: false,
    
    pulling:false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this.tryLogin()
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {
    
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
  
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {
  
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {
  
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function () {
  
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom: function () {
  
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {
  
  },

  // 更新状态
  updateStatus: function(message) {
    this.setData({status:message})
  },

  // 跳转到测试账号
  userTest: function () {
    wx.navigateTo({ url: '../testLogin/testLogin' })
  },

  // 登录
  tryLogin: function() {
    let code, iv, encryptedData
    this.updateStatus('正在读取登录信息...')
    //获取code
    wxlogin().then(data => {
      console.log('wx-login 返回结果：', data)
      code = data.code
      this.updateStatus('正在读取用户信息...')
      //获取用户信息
      return wxGetUserInfo()
    }).then(result => {
      console.log('wx-getUserInfo 返回结果：', result)
      iv = result.iv
      encryptedData = result.encryptedData
      let userInfo = JSON.parse(result.rawData)
      app.userInfo = userInfo
      this.setData({ userInfo, status:'正在登录...' })
      let url = app.globalData.url + '/c/v1/token'
      //获取token
      return login(url, code, iv, encryptedData)
    }).then(loginResult => {
      console.log('登录结果：', loginResult)
      if (loginResult.statusCode == 200) {
        this.data.token = loginResult.data.data.token
        this.data.userid = loginResult.data.data.user.id
        this.updateStatus('当前微信用户没有被邀请或绑定硬件设备，请在App中绑定用户后进行操作-0')
        //处理ticket
        this.tryTicket()
      }else throw new Error('登录失败')
    }).catch(e => {
      console.log('错误信息： ', e)
      this.updateStatus('登录微信账号发生错误')
    })
  },

  tryTicket: function() {
    if (app.globalData.ticket) {
      //ticket存在
      this.getTicket().then(result => {
        console.log('检查ticket : ',result)
        let code = result.data.code
        let statusCode = result.statusCode
        if (statusCode !== 200) {
          // http code error
          if (statusCode == 400) return this.setData({ 'status': '邀请码无效' })
          else if (code == 60001) return this.updateStatus('当前微信用户已注册') // 用户已在ticket所在设备注册过
          else if (code == 60202) return this.updateStatus('邀请码已过期')
          else if (code == 60204) return this.updateStatus('您已申请过加入设备，无需重复提交')
          else return this.updateStatus(getErrorMessage(code))
        } else {
          // 状态码正确 判断是否能fill
          this.setData({
            creatorInfo: result.data.data.creatorInfo,
            station: result.data.data.station
          })
          if (result.data.data == null) {
            //ticket已使用
            this.updateStatus('邀请已完成')
            this.pullTicket(app.globalData.ticket, this.data.userid).then(ticketResult => {
              console.log('pull ticket', ticketResult)
              this.checketPullResult(ticketResult.data.data)
            })
          } else if (result.data.data.user && result.data.data.user.type == 'pending') {
            //ticket已填写
            this.updateStatus('您已申请加入 ' + this.data.station.name + '\n 请等待确认')
            this.data.pulling = true
            this.pulling()
          } else if (false) {
            // 用户已在ticket所在设备注册过

          } else if (false) {
            // 用户已填过ticket所在设备的其他tiecket
          } else {
            // ticket 未被使用
            this.setData({ status: '邀请你加入' + this.data.station.name + '.', state: 'wait' })
          }
        }
      }).catch(e => {
        //接口调用失败
        console.log(e)
        this.updateStatus('数据请求错误')
      })
      
    }else {
      this.updateStatus('当前微信用户没有被邀请或绑定硬件设备，请在App中绑定用户后进行操作-2')
      //todo login
    }
  },
  //填ticket
  submitTicket() {
    let url = app.globalData.url + '/c/v1/tickets/' + app.globalData.ticket + '/invite'
    fillTicket(url, this.data.token).then(data => {
      console.log(data)
      if (data.statusCode == 403) {
        this.setData({ status: getErrorMessage(data.data.code), state: ''})
      }else {
        this.setData({ status: '您已申请加入 ' + this.data.station.name + '\n 请等待主人确认', state: '' })
        this.data.pulling = true
        this.pulling()
      }
    }).catch(e => {
      console.log(e)
    })
  },
  //轮询ticket
  pulling() {
    if (!this.data.pulling) return
    this.getTicket().then(ticketResult => {
      if (ticketResult.statusCode == 403 && ticketResult.data.code == 60001) {
        this.updateStatus('你已被添加进群')
      }
      console.log(ticketResult)
      this.checketPullResult(ticketResult.data.data.user)
      setTimeout(this.pulling, 5000)
    })
  },

  // 查询ticket
  getTicket() {
    let url = app.globalData.url + '/c/v1/tickets/' + app.globalData.ticket
    return checkTicket(url, this.data.token)
  },

  //处理轮询结果
  checketPullResult(ticketResult) {
    this.data.pulling = false
    if (ticketResult.type == 'resolved') {
      this.updateStatus('你已被添加进群')
    } else if (ticketResult.type == 'rejected') {
      this.updateStatus('你已被拒绝')
    } else if (ticketResult.type == 'pending') {
      //nothing
      this.data.pulling = true
    }
  }
})