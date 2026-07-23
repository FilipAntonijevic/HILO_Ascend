using HILO.Api.Models;
using HILO.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace HILO.Api.Controllers;

[ApiController]
[Route("api/game")]
public class GameController(GameService gameService) : ControllerBase
{
    private string SessionId
    {
        get
        {
            if (!Request.Headers.TryGetValue("X-Session-Id", out var id) || string.IsNullOrWhiteSpace(id))
                throw new BadHttpRequestException("Missing X-Session-Id header.", 400);
            return id.ToString();
        }
    }

    [HttpGet("config")]
    public IActionResult Config() => Ok(gameService.GetConfig());

    [HttpGet("state")]
    public ActionResult<GameState> State() => Ok(gameService.GetOrCreate(SessionId));

    [HttpPost("balance")]
    public ActionResult<GameState> SetBalance([FromBody] SetBalanceRequest request)
    {
        try { return Ok(gameService.SetBalance(SessionId, request.Balance)); }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpPost("start")]
    public ActionResult<GameState> Start([FromBody] StartGameRequest request)
    {
        try { return Ok(gameService.Start(SessionId, request.Bet)); }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpPost("guess")]
    public ActionResult<GameState> Guess([FromBody] GuessRequest request)
    {
        try { return Ok(gameService.MakeGuess(SessionId, request.Guess)); }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpPost("cashout")]
    public ActionResult<GameState> CashOut()
    {
        try { return Ok(gameService.CashOut(SessionId)); }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }
}
